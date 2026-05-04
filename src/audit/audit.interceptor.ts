import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { AuditService } from './audit.service';
import { AuditAction } from './entities/audit-log.entity';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

const METHOD_TO_ACTION: Record<string, AuditAction | null> = {
    POST: AuditAction.CREATE,
    PATCH: AuditAction.UPDATE,
    PUT: AuditAction.UPDATE,
    DELETE: AuditAction.DELETE,
    GET: null, // No auditamos lecturas (volumen excesivo).
};

/**
 * Registra automáticamente en audit_log toda petición de escritura exitosa.
 *
 * Casos especiales (login, 2FA, etc.) se registran a mano desde su servicio
 * porque tienen contexto que el interceptor no ve.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
    constructor(private readonly auditService: AuditService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const req = context.switchToHttp().getRequest<
            Request & { user?: AuthUser }
        >();
        const action = METHOD_TO_ACTION[req.method];
        if (!action) return next.handle();

        // No auditamos rutas públicas o de login (auth.service maneja login).
        const url = req.originalUrl || req.url;
        if (
            url.includes('/auth/login') ||
            url.includes('/auth/logout') ||
            !req.user
        ) {
            return next.handle();
        }

        const resource = this.extractResource(url);
        const resourceId = this.extractResourceId(req.params);
        const isBulk = url.endsWith('/bulk') || url.includes('/bulk?');
        const isReorder = url.endsWith('/reorder') || url.includes('/reorder?');

        let auditAction = action;
        if (isBulk && action === AuditAction.UPDATE) auditAction = AuditAction.BULK_UPDATE;
        if (isBulk && action === AuditAction.DELETE) auditAction = AuditAction.BULK_DELETE;
        if (isReorder) auditAction = AuditAction.REORDER;

        return next.handle().pipe(
            tap(() => {
                void this.auditService.record({
                    userId: req.user!.id,
                    userEmail: req.user!.email,
                    action: auditAction,
                    resource,
                    resourceId,
                    details: this.buildDetails(req, isBulk),
                    ip: this.extractIp(req),
                    userAgent: req.headers['user-agent']?.slice(0, 500) ?? null,
                });
            }),
        );
    }

    private extractResource(url: string): string {
        // Quitamos prefijo /api/v1 si lo tiene, y nos quedamos con el primer
        // segmento de la ruta como nombre del recurso ("products", "users", etc).
        const clean = url.replace(/^\/?api\/v\d+\//, '/').split('?')[0];
        const segments = clean.split('/').filter(Boolean);
        return segments[0] ?? 'unknown';
    }

    private extractResourceId(params: Record<string, unknown>): string | null {
        const id = params['id'] ?? params['imageId'];
        return typeof id === 'string' ? id : null;
    }

    private buildDetails(req: Request, isBulk: boolean): Record<string, unknown> | null {
        const body = req.body as Record<string, unknown> | undefined;
        if (!body) return null;

        // Sanitizamos: nunca guardamos passwords/tokens en el log.
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(body)) {
            if (
                /password|token|secret|otp|totp/i.test(key) ||
                key === 'newPassword' ||
                key === 'oldPassword'
            ) {
                sanitized[key] = '[REDACTED]';
            } else if (isBulk && Array.isArray(value)) {
                // En bulk no guardamos los IDs uno por uno (puede ser ruidoso).
                sanitized[key] = `[${value.length} items]`;
            } else {
                sanitized[key] = value;
            }
        }
        return Object.keys(sanitized).length === 0 ? null : sanitized;
    }

    private extractIp(req: Request): string | null {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
        return req.socket.remoteAddress ?? null;
    }
}
