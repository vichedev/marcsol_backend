import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotionLayout1777300000000 implements MigrationInterface {
    name = 'AddPromotionLayout1777300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "promotions_layout_enum" AS ENUM ('CINEMATIC','BILLBOARD','SPOTLIGHT')
        `);
        await queryRunner.query(`
            ALTER TABLE "promotions"
            ADD COLUMN "layout" "promotions_layout_enum" NOT NULL DEFAULT 'CINEMATIC'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "promotions" DROP COLUMN "layout"`);
        await queryRunner.query(`DROP TYPE "promotions_layout_enum"`);
    }
}
