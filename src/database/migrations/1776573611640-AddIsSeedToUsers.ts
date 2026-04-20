import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsSeedToUsers1776573611640 implements MigrationInterface {
    name = 'AddIsSeedToUsers1776573611640'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "isSeed" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isSeed"`);
    }

}
