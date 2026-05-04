import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from './entities/audit-log.entity';

export interface AuditContext {
    userId?: string | null;
    userEmail?: string | null;
    ip?: string | null;
    userAgent?: string | null;
}

export interface AuditEntry extends AuditContext {
    action: AuditAction;
    resource: string;
    resourceId?: string | null;
    details?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger('AuditService');

    constructor(
        @InjectRepository(AuditLog)
        private readonly auditRepo: Repository<AuditLog>,
    ) { }

    /**
     * Registra una entrada en el log de auditoría. Nunca lanza errores hacia
     * arriba: si falla el insert, lo loggea pero no bloquea la acción del
     * usuario.
     */
    async record(entry: AuditEntry): Promise<void> {
        try {
            const log = this.auditRepo.create({
                userId: entry.userId ?? null,
                userEmail: entry.userEmail ?? null,
                action: entry.action,
                resource: entry.resource,
                resourceId: entry.resourceId ?? null,
                details: entry.details ?? null,
                ip: entry.ip ?? null,
                userAgent: entry.userAgent ?? null,
            });
            await this.auditRepo.save(log);
        } catch (err) {
            this.logger.error(
                `Error al registrar audit log: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    async list(params: {
        page?: number;
        limit?: number;
        userId?: string;
        resource?: string;
        action?: AuditAction;
    }) {
        const page = params.page ?? 1;
        const limit = Math.min(params.limit ?? 50, 200);
        const qb = this.auditRepo
            .createQueryBuilder('a')
            .orderBy('a.createdAt', 'DESC');

        if (params.userId) qb.andWhere('a.userId = :userId', { userId: params.userId });
        if (params.resource) qb.andWhere('a.resource = :resource', { resource: params.resource });
        if (params.action) qb.andWhere('a.action = :action', { action: params.action });

        qb.skip((page - 1) * limit).take(limit);
        const [items, total] = await qb.getManyAndCount();
        return {
            items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        };
    }

    async listRecent(limit = 20): Promise<AuditLog[]> {
        return this.auditRepo.find({
            order: { createdAt: 'DESC' },
            take: Math.min(limit, 100),
        });
    }
}
