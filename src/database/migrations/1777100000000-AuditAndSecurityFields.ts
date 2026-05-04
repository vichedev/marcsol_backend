import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditAndSecurityFields1777100000000 implements MigrationInterface {
    name = 'AuditAndSecurityFields1777100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Tipo enum para action
        await queryRunner.query(`
            CREATE TYPE "audit_logs_action_enum" AS ENUM (
                'CREATE','UPDATE','DELETE','LOGIN','LOGIN_FAILED','LOGOUT',
                'PASSWORD_CHANGE','TWOFA_ENABLE','TWOFA_DISABLE',
                'BULK_UPDATE','BULK_DELETE','REORDER'
            )
        `);

        // Tabla audit_logs
        await queryRunner.query(`
            CREATE TABLE "audit_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NULL,
                "userEmail" varchar(200) NULL,
                "action" "audit_logs_action_enum" NOT NULL,
                "resource" varchar(50) NOT NULL,
                "resourceId" varchar(100) NULL,
                "details" jsonb NULL,
                "ip" varchar(45) NULL,
                "userAgent" varchar(500) NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(
            `CREATE INDEX "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_audit_logs_user_created" ON "audit_logs" ("userId","createdAt")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_audit_logs_resource_created" ON "audit_logs" ("resource","createdAt")`,
        );

        // Columnas en users
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD COLUMN "mustChangePassword" boolean NOT NULL DEFAULT false,
            ADD COLUMN "totpSecret" varchar(200) NULL,
            ADD COLUMN "totpEnabled" boolean NOT NULL DEFAULT false,
            ADD COLUMN "lastLoginAt" TIMESTAMP NULL,
            ADD COLUMN "failedLoginAttempts" integer NOT NULL DEFAULT 0
        `);

        // El seed admin debe cambiar password al primer login.
        await queryRunner.query(
            `UPDATE "users" SET "mustChangePassword" = true WHERE "isSeed" = true`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
            DROP COLUMN "failedLoginAttempts",
            DROP COLUMN "lastLoginAt",
            DROP COLUMN "totpEnabled",
            DROP COLUMN "totpSecret",
            DROP COLUMN "mustChangePassword"
        `);
        await queryRunner.query(`DROP INDEX "IDX_audit_logs_resource_created"`);
        await queryRunner.query(`DROP INDEX "IDX_audit_logs_user_created"`);
        await queryRunner.query(`DROP INDEX "IDX_audit_logs_createdAt"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "audit_logs_action_enum"`);
    }
}
