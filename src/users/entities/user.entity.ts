import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column()
    name: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.ADMIN,
    })
    role: UserRole;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: false })
    isSeed: boolean;

    /** Fuerza al usuario a cambiar la contraseña la próxima vez que entre. */
    @Column({ default: false })
    mustChangePassword: boolean;

    /** Secret TOTP (base32) — se guarda cifrado por simplicidad como string. */
    @Column({ type: 'varchar', length: 200, nullable: true })
    totpSecret: string | null;

    @Column({ default: false })
    totpEnabled: boolean;

    @Column({ type: 'timestamp', nullable: true })
    lastLoginAt: Date | null;

    @Column({ type: 'int', default: 0 })
    failedLoginAttempts: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
