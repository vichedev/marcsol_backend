import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
    ) { }

    async create(createUserDto: CreateUserDto): Promise<User> {
        const existing = await this.userRepository.findOne({
            where: { email: createUserDto.email },
        });
        if (existing) {
            throw new ConflictException('Ya existe un usuario con ese email');
        }

        const saltRounds =
            this.configService.get<number>('bcrypt.saltRounds') ?? 10;
        const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

        const user = this.userRepository.create({
            ...createUserDto,
            password: hashedPassword,
            isSeed: false, // Los usuarios creados desde el panel nunca son seed
        });

        const saved = await this.userRepository.save(user);
        return this.sanitize(saved);
    }

    async findAll(): Promise<User[]> {
        const users = await this.userRepository.find({
            order: { createdAt: 'DESC' },
        });
        return users.map((u) => this.sanitize(u));
    }

    async findOne(id: string): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }
        return this.sanitize(user);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOne({ where: { email } });
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        // Protección del seed admin: no se puede desactivar ni cambiar su rol
        if (user.isSeed) {
            if (updateUserDto.isActive === false) {
                throw new ForbiddenException(
                    'No se puede desactivar al super administrador principal del sistema',
                );
            }
            if (updateUserDto.role && updateUserDto.role !== UserRole.SUPER_ADMIN) {
                throw new ForbiddenException(
                    'No se puede cambiar el rol del super administrador principal',
                );
            }
        }

        // No permitir modificar isSeed desde el endpoint
        const { isSeed: _ignored, ...safeDto } = updateUserDto as any;

        Object.assign(user, safeDto);
        const saved = await this.userRepository.save(user);
        return this.sanitize(saved);
    }

    async remove(id: string): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        // Protección del seed admin: no se puede eliminar
        if (user.isSeed) {
            throw new ForbiddenException(
                'No se puede eliminar al super administrador principal del sistema',
            );
        }

        await this.userRepository.delete(id);
    }

    async changePassword(id: string, newPassword: string): Promise<void> {
        const saltRounds =
            this.configService.get<number>('bcrypt.saltRounds') ?? 10;
        const hashed = await bcrypt.hash(newPassword, saltRounds);
        await this.userRepository.update(id, { password: hashed });
    }

    /** Nunca retornar la contraseña en las respuestas */
    private sanitize(user: User): User {
        const { password, ...rest } = user;
        return rest as User;
    }
}