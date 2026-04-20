import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../users/entities/user.entity';

@Injectable()
export class AutoSeedService implements OnApplicationBootstrap {
    private readonly logger = new Logger(AutoSeedService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
    ) { }

    async onApplicationBootstrap() {
        try {
            const email = this.configService.get<string>('seed.adminEmail');
            const password = this.configService.get<string>('seed.adminPassword');
            const name = this.configService.get<string>('seed.adminName');

            if (!email || !password || !name) {
                this.logger.warn(
                    'Variables SEED_* no configuradas. Omitiendo auto-seed.',
                );
                return;
            }

            // ¿Ya existe algún seed admin?
            const existingSeed = await this.userRepository.findOne({
                where: { isSeed: true },
            });

            if (existingSeed) {
                this.logger.log(`Super admin semilla ya existe (${existingSeed.email}). OK.`);
                return;
            }

            // ¿Hay un usuario con ese email pero sin la marca de seed? Lo promovemos
            const existingByEmail = await this.userRepository.findOne({
                where: { email },
            });

            if (existingByEmail) {
                existingByEmail.isSeed = true;
                existingByEmail.role = UserRole.SUPER_ADMIN;
                existingByEmail.isActive = true;
                await this.userRepository.save(existingByEmail);
                this.logger.log(`Usuario existente "${email}" marcado como seed.`);
                return;
            }

            // No existe: lo creamos con la marca de seed
            const saltRounds =
                this.configService.get<number>('bcrypt.saltRounds') ?? 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const user = this.userRepository.create({
                email,
                password: hashedPassword,
                name,
                role: UserRole.SUPER_ADMIN,
                isActive: true,
                isSeed: true,
            });

            await this.userRepository.save(user);

            this.logger.log(`✅ Super admin semilla "${email}" creado automáticamente.`);
            this.logger.warn(
                'IMPORTANTE: inicia sesión y cambia la contraseña por defecto.',
            );
        } catch (err) {
            this.logger.error('Error en auto-seed:', err.message);
        }
    }
}