import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { SignOptions } from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwoFactorService } from './twofa.service';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';

@Module({
    imports: [
        UsersModule,
        TypeOrmModule.forFeature([User]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService): JwtModuleOptions => {
                const secret = config.get<string>('jwt.secret');
                if (!secret) {
                    throw new Error('JWT_SECRET no está definido');
                }
                const expiresIn = (config.get<string>('jwt.expiresIn') ??
                    '1d') as SignOptions['expiresIn'];

                return {
                    secret,
                    signOptions: { expiresIn },
                };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, TwoFactorService],
    exports: [AuthService, TwoFactorService],
})
export class AuthModule { }
