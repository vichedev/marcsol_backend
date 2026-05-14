import {
    IsEmail,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
    MaxLength,
    ValidateIf,
} from 'class-validator';

/**
 * Todos los campos son opcionales (es un PATCH parcial). Si un campo viene
 * como string vacío lo aceptamos para que el admin pueda "vaciar" un valor
 * en la base. Si viene como `null` también.
 */
export class UpdateSiteSettingsDto {
    // ── EmailJS ─────────────────────────────────────────────────────────
    @IsOptional() @IsString() @MaxLength(255)
    emailjsPublicKey?: string | null;

    @IsOptional() @IsString() @MaxLength(255)
    emailjsServiceId?: string | null;

    @IsOptional() @IsString() @MaxLength(255)
    emailjsTemplateContact?: string | null;

    @IsOptional() @IsString() @MaxLength(255)
    emailjsTemplateSubscribe?: string | null;

    @IsOptional()
    @ValidateIf((_, v) => v != null && v !== '')
    @IsEmail({}, { message: 'adminEmail debe ser un correo válido' })
    @MaxLength(255)
    adminEmail?: string | null;

    // ── Contacto ────────────────────────────────────────────────────────
    @IsOptional() @IsString() @MaxLength(50)
    contactPhonePrimary?: string | null;

    @IsOptional() @IsString() @MaxLength(50)
    contactPhoneSecondary?: string | null;

    @IsOptional()
    @ValidateIf((_, v) => v != null && v !== '')
    @IsEmail({}, { message: 'contactEmailPrimary debe ser un correo válido' })
    @MaxLength(255)
    contactEmailPrimary?: string | null;

    @IsOptional()
    @ValidateIf((_, v) => v != null && v !== '')
    @IsEmail({}, { message: 'contactEmailSecondary debe ser un correo válido' })
    @MaxLength(255)
    contactEmailSecondary?: string | null;

    @IsOptional() @IsString() @MaxLength(255)
    contactAddress?: string | null;

    @IsOptional() @IsString() @MaxLength(100)
    contactCity?: string | null;

    @IsOptional() @IsString() @MaxLength(100)
    contactCountry?: string | null;

    @IsOptional()
    @ValidateIf((_, v) => v != null && v !== '')
    @IsUrl({}, { message: 'contactMapUrl debe ser una URL válida' })
    contactMapUrl?: string | null;

    /** WhatsApp en E.164 sin "+": 8-15 dígitos. */
    @IsOptional()
    @ValidateIf((_, v) => v != null && v !== '')
    @Matches(/^\d{8,15}$/, {
        message: 'whatsappNumber debe contener solo dígitos (8-15)',
    })
    whatsappNumber?: string | null;

    // ── Horario ─────────────────────────────────────────────────────────
    @IsOptional() @IsString() @MaxLength(100)
    scheduleWeekdays?: string | null;

    @IsOptional() @IsString() @MaxLength(100)
    scheduleSaturday?: string | null;

    @IsOptional() @IsString() @MaxLength(100)
    scheduleSunday?: string | null;

    // ── Redes sociales ──────────────────────────────────────────────────
    @IsOptional()
    @ValidateIf((_, v) => v != null && v !== '')
    @IsUrl({}, { message: 'socialFacebook debe ser una URL válida' })
    socialFacebook?: string | null;

    @IsOptional()
    @ValidateIf((_, v) => v != null && v !== '')
    @IsUrl({}, { message: 'socialInstagram debe ser una URL válida' })
    socialInstagram?: string | null;

    @IsOptional()
    @ValidateIf((_, v) => v != null && v !== '')
    @IsUrl({}, { message: 'socialTiktok debe ser una URL válida' })
    socialTiktok?: string | null;

    // ── Branding ────────────────────────────────────────────────────────
    @IsOptional() @IsString() @MaxLength(150)
    companyName?: string | null;

    @IsOptional() @IsString() @MaxLength(255)
    companyTagline?: string | null;
}
