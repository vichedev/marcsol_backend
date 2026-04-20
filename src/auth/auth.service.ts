import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) { }

    async login(loginDto: LoginDto) {
        const user = await this.usersService.findByEmail(loginDto.email);
        if (!user) {
            throw new UnauthorizedException('Credenciales inválidas');
        }
        if (!user.isActive) {
            throw new UnauthorizedException('Usuario inactivo');
        }

        const isValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isValid) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken = this.jwtService.sign(payload);

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        };
    }

    async changeOwnPassword(
        userId: string,
        oldPassword: string,
        newPassword: string,
    ) {
        const user = await this.usersService.findByEmail(
            (await this.usersService.findOne(userId)).email,
        );
        if (!user) {
            throw new UnauthorizedException();
        }
        const valid = await bcrypt.compare(oldPassword, user.password);
        if (!valid) {
            throw new BadRequestException('La contraseña actual es incorrecta');
        }
        await this.usersService.changePassword(userId, newPassword);
        return { message: 'Contraseña actualizada correctamente' };
    }

    async updateProfile(userId: string, updates: { name?: string }) {
        const user = await this.usersService.findOne(userId);
        if (!user) {
            throw new UnauthorizedException();
        }
        const updated = await this.usersService.update(userId, updates);
        return updated;
    }

}