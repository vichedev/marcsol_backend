import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductImagesAndStatus1777000000000 implements MigrationInterface {
    name = 'AddProductImagesAndStatus1777000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Tipo enum status
        await queryRunner.query(`
            CREATE TYPE "products_status_enum" AS ENUM (
                'DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'
            )
        `);

        // 2. Columnas nuevas en products
        await queryRunner.query(`
            ALTER TABLE "products"
            ADD COLUMN "status" "products_status_enum" NOT NULL DEFAULT 'PUBLISHED',
            ADD COLUMN "scheduledAt" TIMESTAMP NULL
        `);

        // 3. Tabla product_images
        await queryRunner.query(`
            CREATE TABLE "product_images" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "productId" uuid NOT NULL,
                "url" varchar NOT NULL,
                "alt" varchar(200) NULL,
                "sortOrder" integer NOT NULL DEFAULT 0,
                "isPrimary" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_product_images" PRIMARY KEY ("id"),
                CONSTRAINT "FK_product_images_product" FOREIGN KEY ("productId")
                    REFERENCES "products"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(
            `CREATE INDEX "IDX_product_images_productId" ON "product_images" ("productId")`,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_product_images_product_sort" ON "product_images" ("productId", "sortOrder")`,
        );

        // 4. Hidratar product_images con la imageUrl actual de cada producto
        // como imagen primaria (mantiene compatibilidad).
        await queryRunner.query(`
            INSERT INTO "product_images" ("productId", "url", "sortOrder", "isPrimary")
            SELECT id, "imageUrl", 0, true
            FROM "products"
            WHERE "imageUrl" IS NOT NULL AND "imageUrl" != ''
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_product_images_product_sort"`);
        await queryRunner.query(`DROP INDEX "IDX_product_images_productId"`);
        await queryRunner.query(`DROP TABLE "product_images"`);
        await queryRunner.query(
            `ALTER TABLE "products" DROP COLUMN "scheduledAt", DROP COLUMN "status"`,
        );
        await queryRunner.query(`DROP TYPE "products_status_enum"`);
    }
}
