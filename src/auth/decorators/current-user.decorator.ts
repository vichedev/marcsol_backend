import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '../../users/entities/user.entity';

/** Forma del usuario inyectado en `request.user` por la JwtStrategy. */
export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    mustChangePassword: boolean;
    totpEnabled: boolean;
}

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthUser => {
        const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
        return request.user;
    },
);
