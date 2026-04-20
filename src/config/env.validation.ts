import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: Joi.number().default(3000),
    API_PREFIX: Joi.string().default('api/v1'),

    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().required(),
    DB_USERNAME: Joi.string().required(),
    DB_PASSWORD: Joi.string().required(),
    DB_DATABASE: Joi.string().required(),
    DB_SYNCHRONIZE: Joi.boolean().default(false),
    DB_LOGGING: Joi.boolean().default(false),

    JWT_SECRET: Joi.string().min(32).required(),
    JWT_EXPIRES_IN: Joi.string().default('1d'),

    CORS_ORIGIN: Joi.string().required(),

    BCRYPT_SALT_ROUNDS: Joi.number().default(10),

    SEED_ADMIN_EMAIL: Joi.string().email().required(),
    SEED_ADMIN_PASSWORD: Joi.string().min(8).required(),
    SEED_ADMIN_NAME: Joi.string().required(),

    UPLOAD_DEST: Joi.string().default('./uploads'),
    UPLOAD_MAX_SIZE: Joi.number().default(5242880),
});