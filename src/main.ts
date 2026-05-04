import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger:
            process.env.NODE_ENV === 'production'
                ? ['log', 'warn', 'error']
                : ['log', 'warn', 'error', 'debug', 'verbose'],
    });
    const config = app.get(ConfigService);
    const logger = new Logger('Bootstrap');

    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            contentSecurityPolicy: false,
        }),
    );

    app.use(cookieParser());

    // Confiar en el primer proxy (HTTPS detrás de un load balancer / cookies "secure").
    app.set('trust proxy', 1);

    const apiPrefix = config.get<string>('apiPrefix') ?? 'api/v1';
    app.setGlobalPrefix(apiPrefix);

    const corsOrigins = config.get<string[]>('cors.origin') ?? [];
    app.enableCors({
        origin: corsOrigins.length === 0 ? false : corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );

    app.useGlobalFilters(new AllExceptionsFilter(config));

    const port = config.get<number>('port') ?? 3000;
    await app.listen(port);
    logger.log(`Backend corriendo en puerto ${port} (${apiPrefix})`);
}
bootstrap();
