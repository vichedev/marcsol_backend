import { MigrationInterface, QueryRunner } from 'typeorm';

export class CategoriesNested1777200000000 implements MigrationInterface {
    name = 'CategoriesNested1777200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "categories"
            ADD COLUMN "parentId" uuid NULL,
            ADD COLUMN "sortOrder" integer NOT NULL DEFAULT 0,
            ADD CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parentId")
                REFERENCES "categories"("id") ON DELETE SET NULL
        `);
        await queryRunner.query(
            `CREATE INDEX "IDX_categories_parentId" ON "categories" ("parentId")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_categories_parentId"`);
        await queryRunner.query(`
            ALTER TABLE "categories"
            DROP CONSTRAINT "FK_categories_parent",
            DROP COLUMN "sortOrder",
            DROP COLUMN "parentId"
        `);
    }
}
