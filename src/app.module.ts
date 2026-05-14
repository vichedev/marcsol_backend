import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import type { ServerResponse } from 'http';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { UploadsModule } from './uploads/uploads.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { PromotionsModule } from './promotions/promotions.module';
import { AdvertisementsModule } from './advertisements/advertisements.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { SeedsModule } from './database/seeds/seeds.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttl') ?? 60000,
            limit: config.get<number>('throttle.limit') ?? 120,
          },
        ],
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: config.get<boolean>('database.synchronize'),
        logging: config.get<boolean>('database.logging'),
      }),
    }),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const corsOrigins = config.get<string[]>('cors.origin') ?? [];
        const apiPrefix = config.get<string>('apiPrefix') ?? 'api/v1';
        return [
          // 1) Uploads de imágenes (cache largo, son archivos con UUID)
          {
            rootPath: join(
              process.cwd(),
              config.get<string>('upload.dest') ?? './uploads',
            ),
            serveRoot: '/static',
            serveStaticOptions: {
              setHeaders: (res: ServerResponse, _path: string) => {
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                if (corsOrigins.length === 1) {
                  res.setHeader('Access-Control-Allow-Origin', corsOrigins[0]);
                  res.setHeader('Vary', 'Origin');
                }
              },
            },
          },
          // 2) SPA del frontend: el build de Vite se copia a ./public en deploy.
          //    Sirve index.html como fallback para rutas del router cliente.
          {
            rootPath: join(process.cwd(), 'public'),
            serveRoot: '/',
            exclude: [`/${apiPrefix}/(.*)`, '/static/(.*)'],
            serveStaticOptions: {
              index: ['index.html'],
              setHeaders: (res: ServerResponse, path: string) => {
                if (path.endsWith('index.html')) {
                  // El HTML debe revalidarse para que los despliegues se vean al
                  // siguiente refresh; los assets JS/CSS llevan hash en el nombre.
                  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                } else {
                  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                }
              },
            },
          },
        ];
      },
    }),
    AuthModule,
    UsersModule,
    UploadsModule,
    CategoriesModule,
    ProductsModule,
    PromotionsModule,
    AdvertisementsModule,
    DashboardModule,
    AuditModule,
    SeedsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule { }
