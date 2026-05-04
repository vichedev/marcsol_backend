import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type JwtFromRequestFunction } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';

export interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private readonly usersService: UsersService,
    ) {
        const secret = configService.get<string>('jwt.secret');
        if (!secret) {
            throw new Error('JWT_SECRET no está definido');
        }
        const cookieName =
            configService.get<string>('cookie.name') ?? 'ws_session';

        const fromCookie: JwtFromRequestFunction = (req: Request) => {
            const cookies = (req as Request & {
                cookies?: Record<string, string>;
            }).cookies;
            return cookies?.[cookieName] ?? null;
        };

        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                fromCookie,
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: JwtPayload) {
        const user = await this.usersService.findByEmail(payload.email);
        if (!user || !user.isActive) {
            throw new UnauthorizedException('Usuario inválido o inactivo');
        }
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
            totpEnabled: user.totpEnabled,
        };
    }
}
