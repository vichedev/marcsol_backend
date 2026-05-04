import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';

export type SafeUser = Omit<User, 'password'>;

export interface PaginatedUsers {
    items: SafeUser[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
    ) { }

    async create(createUserDto: CreateUserDto): Promise<SafeUser> {
        const existing = await this.userRepository.findOne({
            where: { email: createUserDto.email },
        });
        if (existing) {
            throw new ConflictException('Ya existe un usuario con ese email');
        }

        const saltRounds =
            this.configService.get<number>('bcrypt.saltRounds') ?? 12;
        const hashedPassword = await bcrypt.hash(
            createUserDto.password,
            saltRounds,
        );

        const user = this.userRepository.create({
            ...createUserDto,
            password: hashedPassword,
            isSeed: false,
        });

        const saved = await this.userRepository.save(user);
        return this.sanitize(saved);
    }

    async findAll(query: QueryUsersDto = {}): Promise<PaginatedUsers> {
        const page = query.page ?? 1;
        const limit = Math.min(query.limit ?? 20, 100);
        const search = query.search?.trim();

        const where = search
            ? [
                { email: ILike(`%${search}%`) },
                { name: ILike(`%${search}%`) },
            ]
            : undefined;

        const [users, total] = await this.userRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return {
            items: users.map((u) => this.sanitize(u)),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }

    async findOne(id: string): Promise<SafeUser> {
        const user = await this.findEntityById(id);
        return this.sanitize(user);
    }

    /** Devuelve la entidad completa (incluye hash de password). Solo uso interno. */
    async findEntityById(id: string): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }
        return user;
    }

    findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOne({ where: { email } });
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<SafeUser> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        if (user.isSeed) {
            if (updateUserDto.isActive === false) {
                throw new ForbiddenException(
                    'No se puede desactivar al super administrador principal del sistema',
                );
            }
            if (
                updateUserDto.role &&
                updateUserDto.role !== UserRole.SUPER_ADMIN
            ) {
                throw new ForbiddenException(
                    'No se puede cambiar el rol del super administrador principal',
                );
            }
        }

        // Defensa en profundidad: nunca se modifican estas columnas vía endpoint.
        const sanitized: Partial<UpdateUserDto> = { ...updateUserDto };
        delete (sanitized as Record<string, unknown>).isSeed;
        delete (sanitized as Record<string, unknown>).password;

        Object.assign(user, sanitized);
        const saved = await this.userRepository.save(user);
        return this.sanitize(saved);
    }

    async remove(id: string): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        if (user.isSeed) {
            throw new ForbiddenException(
                'No se puede eliminar al super administrador principal del sistema',
            );
        }

        await this.userRepository.delete(id);
    }

    async changePassword(id: string, newPassword: string): Promise<void> {
        const saltRounds =
            this.configService.get<number>('bcrypt.saltRounds') ?? 12;
        const hashed = await bcrypt.hash(newPassword, saltRounds);
        await this.userRepository.update(id, { password: hashed });
    }

    /** Nunca retornar la contraseña en las respuestas. */
    private sanitize(user: User): SafeUser {
        const { password: _password, ...rest } = user;
        return rest;
    }
}
