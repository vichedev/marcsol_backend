import { MigrationInterface, QueryRunner } from "typeorm";

export class EnrichAdvertisements1776578847915 implements MigrationInterface {
    name = 'EnrichAdvertisements1776578847915'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advertisements" ADD "subtitle" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "advertisements" ADD "badgeText" character varying(30)`);
        await queryRunner.query(`CREATE TYPE "public"."advertisements_badgecolor_enum" AS ENUM('RED', 'AMBER', 'GREEN', 'BLUE', 'PURPLE', 'SUN')`);
        await queryRunner.query(`ALTER TABLE "advertisements" ADD "badgeColor" "public"."advertisements_badgecolor_enum" NOT NULL DEFAULT 'SUN'`);
        await queryRunner.query(`ALTER TABLE "advertisements" ADD "ctaText" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "advertisements" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "advertisements" ADD "title" character varying(150) NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."advertisements_position_enum" RENAME TO "advertisements_position_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."advertisements_position_enum" AS ENUM('HOME_TOP', 'HOME_MIDDLE', 'HOME_BOTTOM')`);
        await queryRunner.query(`ALTER TABLE "advertisements" ALTER COLUMN "position" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "advertisements" ALTER COLUMN "position" TYPE "public"."advertisements_position_enum" USING "position"::"text"::"public"."advertisements_position_enum"`);
        await queryRunner.query(`ALTER TABLE "advertisements" ALTER COLUMN "position" SET DEFAULT 'HOME_MIDDLE'`);
        await queryRunner.query(`DROP TYPE "public"."advertisements_position_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."advertisements_position_enum_old" AS ENUM('HOME_TOP', 'HOME_MIDDLE', 'HOME_BOTTOM', 'SIDEBAR')`);
        await queryRunner.query(`ALTER TABLE "advertisements" ALTER COLUMN "position" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "advertisements" ALTER COLUMN "position" TYPE "public"."advertisements_position_enum_old" USING "position"::"text"::"public"."advertisements_position_enum_old"`);
        await queryRunner.query(`ALTER TABLE "advertisements" ALTER COLUMN "position" SET DEFAULT 'HOME_MIDDLE'`);
        await queryRunner.query(`DROP TYPE "public"."advertisements_position_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."advertisements_position_enum_old" RENAME TO "advertisements_position_enum"`);
        await queryRunner.query(`ALTER TABLE "advertisements" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "advertisements" ADD "title" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "advertisements" DROP COLUMN "ctaText"`);
        await queryRunner.query(`ALTER TABLE "advertisements" DROP COLUMN "badgeColor"`);
        await queryRunner.query(`DROP TYPE "public"."advertisements_badgecolor_enum"`);
        await queryRunner.query(`ALTER TABLE "advertisements" DROP COLUMN "badgeText"`);
        await queryRunner.query(`ALTER TABLE "advertisements" DROP COLUMN "subtitle"`);
    }

}
