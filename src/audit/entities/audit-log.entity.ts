import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

export enum AuditAction {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    LOGIN = 'LOGIN',
    LOGIN_FAILED = 'LOGIN_FAILED',
    LOGOUT = 'LOGOUT',
    PASSWORD_CHANGE = 'PASSWORD_CHANGE',
    TWOFA_ENABLE = 'TWOFA_ENABLE',
    TWOFA_DISABLE = 'TWOFA_DISABLE',
    BULK_UPDATE = 'BULK_UPDATE',
    BULK_DELETE = 'BULK_DELETE',
    REORDER = 'REORDER',
}

@Entity('audit_logs')
@Index(['createdAt'])
@Index(['userId', 'createdAt'])
@Index(['resource', 'createdAt'])
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /** Usuario que ejecutó la acción (null si fue anónimo, p. ej. login fallido). */
    @Column({ type: 'uuid', nullable: true })
    userId: string | null;

    /** Email cacheado al momento de la acción (sirve aunque el usuario sea borrado). */
    @Column({ type: 'varchar', length: 200, nullable: true })
    userEmail: string | null;

    @Column({ type: 'enum', enum: AuditAction })
    action: AuditAction;

    /** Recurso afectado: "products", "users", "auth", etc. */
    @Column({ type: 'varchar', length: 50 })
    resource: string;

    /** ID del recurso si aplica. */
    @Column({ type: 'varchar', length: 100, nullable: true })
    resourceId: string | null;

    /** Detalles adicionales: changes, payload sanitizado, mensaje de error, etc. */
    @Column({ type: 'jsonb', nullable: true })
    details: Record<string, unknown> | null;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ip: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    userAgent: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
