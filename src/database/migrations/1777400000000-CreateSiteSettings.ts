import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla singleton site_settings.
 * Almacena toda la configuración editable desde el dashboard:
 * EmailJS, contacto, horario, redes sociales y branding.
 */
export class CreateSiteSettings1777400000000 implements MigrationInterface {
    name = 'CreateSiteSettings1777400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // IF NOT EXISTS para que esta migración sea segura aunque la tabla
        // ya haya sido creada por synchronize=true en otros entornos.
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "site_settings" (
                "id" integer NOT NULL DEFAULT 1,
                "emailjsPublicKey" varchar(255),
                "emailjsServiceId" varchar(255),
                "emailjsTemplateContact" varchar(255),
                "emailjsTemplateSubscribe" varchar(255),
                "adminEmail" varchar(255),
                "contactPhonePrimary" varchar(50),
                "contactPhoneSecondary" varchar(50),
                "contactEmailPrimary" varchar(255),
                "contactEmailSecondary" varchar(255),
                "contactAddress" varchar(255),
                "contactCity" varchar(100),
                "contactCountry" varchar(100),
                "contactMapUrl" text,
                "whatsappNumber" varchar(20),
                "scheduleWeekdays" varchar(100),
                "scheduleSaturday" varchar(100),
                "scheduleSunday" varchar(100),
                "socialFacebook" varchar(255),
                "socialInstagram" varchar(255),
                "socialTiktok" varchar(255),
                "companyName" varchar(150),
                "companyTagline" varchar(255),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_site_settings" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_site_settings_singleton" CHECK ("id" = 1)
            )
        `);

        // Inserta la fila singleton con valores nulos. El service la "completa"
        // mediante PATCH desde el dashboard.
        await queryRunner.query(`
            INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "site_settings"`);
    }
}
