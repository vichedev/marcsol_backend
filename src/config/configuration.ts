export default () => ({
    nodeEnv: process.env.NODE_ENV ?? 'development',
    isProduction: process.env.NODE_ENV === 'production',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',

    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        synchronize: process.env.DB_SYNCHRONIZE === 'true',
        logging: process.env.DB_LOGGING === 'true',
    },

    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    },

    cookie: {
        name: process.env.COOKIE_NAME ?? 'ws_session',
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: (process.env.COOKIE_SAMESITE ?? 'lax') as
            | 'lax'
            | 'strict'
            | 'none',
        domain: process.env.COOKIE_DOMAIN || undefined,
    },

    cors: {
        origin: (process.env.CORS_ORIGIN ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    },

    bcrypt: {
        saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
    },

    throttle: {
        ttl: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
    },

    seed: {
        adminEmail: process.env.SEED_ADMIN_EMAIL,
        adminPassword: process.env.SEED_ADMIN_PASSWORD,
        adminName: process.env.SEED_ADMIN_NAME,
    },

    upload: {
        dest: process.env.UPLOAD_DEST ?? './uploads',
        maxSize: parseInt(process.env.UPLOAD_MAX_SIZE ?? '5242880', 10),
    },
});
