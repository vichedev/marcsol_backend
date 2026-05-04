import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

function getEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Falta la variable de entorno: ${key}`);
    }
    return value;
}

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: getEnv('DB_HOST'),
    port: parseInt(getEnv('DB_PORT'), 10),
    username: getEnv('DB_USERNAME'),
    password: getEnv('DB_PASSWORD'),
    database: getEnv('DB_DATABASE'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
});
