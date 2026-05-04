import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import type { Response, CookieOptions, Request } from 'express';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { TwoFactorService } from './twofa.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

const MAX_FAILED_ATTEMPTS = 10;

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly twoFactorService: TwoFactorService,
        private readonly auditService: AuditService,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    async login(loginDto: LoginDto, res: Response, req: Request) {
        const ip = this.extractIp(req);
        const userAgent = req.headers['user-agent']?.slice(0, 500) ?? null;

        const user = await this.usersService.findByEmail(loginDto.email);
        if (!user) {
            await this.auditService.record({
                action: AuditAction.LOGIN_FAILED,
                resource: 'auth',
                userEmail: loginDto.email,
                ip,
                userAgent,
                details: { reason: 'user_not_found' },
            });
            throw new UnauthorizedException('Credenciales inválidas');
        }

        if (!user.isActive) {
            await this.auditService.record({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.LOGIN_FAILED,
                resource: 'auth',
                ip,
                userAgent,
                details: { reason: 'inactive' },
            });
            throw new UnauthorizedException('Usuario inactivo');
        }

        if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
            await this.auditService.record({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.LOGIN_FAILED,
                resource: 'auth',
                ip,
                userAgent,
                details: { reason: 'locked' },
            });
            throw new UnauthorizedException(
                'Cuenta bloqueada por demasiados intentos. Contacta al administrador.',
            );
        }

        const isValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isValid) {
            await this.userRepo.update(user.id, {
                failedLoginAttempts: user.failedLoginAttempts + 1,
            });
            await this.auditService.record({
                userId: user.id,
                userEmail: user.email,
                action: AuditAction.LOGIN_FAILED,
                resource: 'auth',
                ip,
                userAgent,
                details: { reason: 'wrong_password' },
            });
            throw new UnauthorizedException('Credenciales inválidas');
        }

        // Si tiene 2FA habilitado, exige el código.
        if (user.totpEnabled && user.totpSecret) {
            if (!loginDto.totpCode) {
                throw new UnauthorizedException({
                    message: 'Código de 2FA requerido',
                    twoFactorRequired: true,
                });
            }
            const ok = this.twoFactorService.verifyToken(
                user.totpSecret,
                loginDto.totpCode,
            );
            if (!ok) {
                await this.userRepo.update(user.id, {
                    failedLoginAttempts: user.failedLoginAttempts + 1,
                });
                await this.auditService.record({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.LOGIN_FAILED,
                    resource: 'auth',
                    ip,
                    userAgent,
                    details: { reason: 'wrong_2fa' },
                });
                throw new UnauthorizedException('Código de 2FA inválido');
            }
        }

        // Login exitoso: reseteamos contador y guardamos lastLoginAt.
        await this.userRepo.update(user.id, {
            failedLoginAttempts: 0,
            lastLoginAt: new Date(),
        });

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };
        const accessToken = this.jwtService.sign(payload);
        const cookieName =
            this.configService.get<string>('cookie.name') ?? 'ws_session';
        res.cookie(cookieName, accessToken, this.cookieOptions());

        await this.auditService.record({
            userId: user.id,
            userEmail: user.email,
            action: AuditAction.LOGIN,
            resource: 'auth',
            ip,
            userAgent,
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                mustChangePassword: user.mustChangePassword,
                totpEnabled: user.totpEnabled,
            },
        };
    }

    async logout(res: Response, userId?: string, userEmail?: string): Promise<void> {
        const cookieName =
            this.configService.get<string>('cookie.name') ?? 'ws_session';
        res.clearCookie(cookieName, this.cookieOptions(0));
        if (userId) {
            await this.auditService.record({
                userId,
                userEmail: userEmail ?? null,
                action: AuditAction.LOGOUT,
                resource: 'auth',
            });
        }
    }

    async changeOwnPassword(
        userId: string,
        oldPassword: string,
        newPassword: string,
    ) {
        const user = await this.usersService.findEntityById(userId);
        if (!user) {
            throw new UnauthorizedException();
        }
        const valid = await bcrypt.compare(oldPassword, user.password);
        if (!valid) {
            throw new BadRequestException('La contraseña actual es incorrecta');
        }
        if (oldPassword === newPassword) {
            throw new BadRequestException(
                'La nueva contraseña no puede ser igual a la actual',
            );
        }
        await this.usersService.changePassword(userId, newPassword);
        await this.userRepo.update(userId, { mustChangePassword: false });

        await this.auditService.record({
            userId,
            userEmail: user.email,
            action: AuditAction.PASSWORD_CHANGE,
            resource: 'auth',
        });

        return { message: 'Contraseña actualizada correctamente' };
    }

    async updateProfile(userId: string, updates: { name?: string }) {
        const user = await this.usersService.findOne(userId);
        if (!user) {
            throw new UnauthorizedException();
        }
        return this.usersService.update(userId, updates);
    }

    private cookieOptions(maxAgeOverrideMs?: number): CookieOptions {
        const sameSite =
            this.configService.get<'lax' | 'strict' | 'none'>('cookie.sameSite') ??
            'lax';
        const secure = this.configService.get<boolean>('cookie.secure') ?? false;
        const domain = this.configService.get<string>('cookie.domain');
        const expiresIn =
            this.configService.get<string>('jwt.expiresIn') ?? '1d';
        return {
            httpOnly: true,
            secure,
            sameSite,
            ...(domain ? { domain } : {}),
            path: '/',
            maxAge:
                maxAgeOverrideMs !== undefined
                    ? maxAgeOverrideMs
                    : this.parseDurationMs(expiresIn),
        };
    }

    private parseDurationMs(input: string): number {
        const match = /^(\d+)\s*([smhd])?$/.exec(input.trim());
        if (!match) return 24 * 60 * 60 * 1000;
        const value = parseInt(match[1], 10);
        const unit = match[2] ?? 's';
        const multipliers: Record<string, number> = {
            s: 1000,
            m: 60_000,
            h: 3_600_000,
            d: 86_400_000,
        };
        return value * (multipliers[unit] ?? 1000);
    }

    private extractIp(req: Request): string | null {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
        return req.socket.remoteAddress ?? null;
    }
}
