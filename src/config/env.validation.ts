import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: Joi.number().port().default(3000),
    API_PREFIX: Joi.string().default('api/v1'),

    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().port().required(),
    DB_USERNAME: Joi.string().required(),
    DB_PASSWORD: Joi.string().required(),
    DB_DATABASE: Joi.string().required(),
    DB_SYNCHRONIZE: Joi.boolean().default(false),
    DB_LOGGING: Joi.boolean().default(false),

    // En producción exigimos un secreto fuerte (>= 48 chars).
    JWT_SECRET: Joi.string().when('NODE_ENV', {
        is: 'production',
        then: Joi.string().min(48).required(),
        otherwise: Joi.string().min(32).required(),
    }),
    JWT_EXPIRES_IN: Joi.string().default('1d'),

    COOKIE_NAME: Joi.string().default('ws_session'),
    COOKIE_SECURE: Joi.boolean().default(false),
    COOKIE_SAMESITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
    COOKIE_DOMAIN: Joi.string().allow('').optional(),

    CORS_ORIGIN: Joi.string().required(),

    BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),

    THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
    THROTTLE_LIMIT: Joi.number().integer().min(10).default(120),

    SEED_ADMIN_EMAIL: Joi.string().email().required(),
    SEED_ADMIN_PASSWORD: Joi.string().min(8).required(),
    SEED_ADMIN_NAME: Joi.string().required(),

    UPLOAD_DEST: Joi.string().default('./uploads'),
    UPLOAD_MAX_SIZE: Joi.number().integer().min(1024).default(5242880),
})
    // Si COOKIE_SAMESITE=none, entonces COOKIE_SECURE debe ser true (regla del navegador).
    .custom((value, helpers) => {
        if (value.COOKIE_SAMESITE === 'none' && !value.COOKIE_SECURE) {
            return helpers.error('any.invalid', {
                message:
                    'COOKIE_SAMESITE=none requiere COOKIE_SECURE=true (HTTPS).',
            });
        }
        if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) {
            // Aviso suave: en prod casi siempre quieres cookies seguras. No fallamos por compatibilidad.
        }
        return value;
    });
