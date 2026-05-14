import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * Configuración del sitio — patrón singleton.
 * Siempre existe una sola fila con id=1. El service se encarga de crearla
 * la primera vez si no está.
 */
@Entity('site_settings')
export class SiteSettings {
    @PrimaryColumn({ type: 'int', default: 1 })
    id: number;

    // ── EmailJS — config para enviar contacto y suscripciones desde el browser ──
    @Column({ type: 'varchar', length: 255, nullable: true })
    emailjsPublicKey: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    emailjsServiceId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    emailjsTemplateContact: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    emailjsTemplateSubscribe: string | null;

    /** Correo del admin que recibe los mensajes de contacto. */
    @Column({ type: 'varchar', length: 255, nullable: true })
    adminEmail: string | null;

    // ── Información de contacto pública ──────────────────────────────────
    @Column({ type: 'varchar', length: 50, nullable: true })
    contactPhonePrimary: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    contactPhoneSecondary: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    contactEmailPrimary: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    contactEmailSecondary: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    contactAddress: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    contactCity: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    contactCountry: string | null;

    /** URL de un embed de Google Maps o similar (opcional). */
    @Column({ type: 'text', nullable: true })
    contactMapUrl: string | null;

    /** Número de WhatsApp en formato E.164 sin "+", ej: 593999999999. */
    @Column({ type: 'varchar', length: 20, nullable: true })
    whatsappNumber: string | null;

    // ── Horario de atención ──────────────────────────────────────────────
    @Column({ type: 'varchar', length: 100, nullable: true })
    scheduleWeekdays: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    scheduleSaturday: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    scheduleSunday: string | null;

    // ── Redes sociales ───────────────────────────────────────────────────
    @Column({ type: 'varchar', length: 255, nullable: true })
    socialFacebook: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    socialInstagram: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    socialTiktok: string | null;

    // ── Branding / marca ─────────────────────────────────────────────────
    @Column({ type: 'varchar', length: 150, nullable: true })
    companyName: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    companyTagline: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
