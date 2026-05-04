import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as otplib from 'otplib';
import * as QRCode from 'qrcode';
import { User } from '../users/entities/user.entity';

const TOTP_ISSUER = 'WebDinamicaAdmin';

// Tolerancia ±30s por desincronización de reloj entre cliente y servidor.
const EPOCH_TOLERANCE_SECONDS = 30;

@Injectable()
export class TwoFactorService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    async beginSetup(
        userId: string,
    ): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('Usuario no encontrado');
        if (user.totpEnabled) {
            throw new BadRequestException('2FA ya está activo en esta cuenta');
        }

        const secret = otplib.generateSecret();
        const otpauthUrl = otplib.generateURI({
            label: user.email,
            secret,
            issuer: TOTP_ISSUER,
        });
        const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

        // Guardamos el secret pero NO marcamos enabled hasta que verifique.
        await this.userRepo.update(userId, { totpSecret: secret });

        return { otpauthUrl, qrDataUrl };
    }

    async verifyAndEnable(userId: string, token: string): Promise<void> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user || !user.totpSecret) {
            throw new BadRequestException('Primero solicita el setup de 2FA');
        }
        if (user.totpEnabled) {
            throw new BadRequestException('2FA ya está activo');
        }
        if (!this.verify(user.totpSecret, token)) {
            throw new BadRequestException('Código inválido');
        }
        await this.userRepo.update(userId, { totpEnabled: true });
    }

    async disable(userId: string, token: string): Promise<void> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user || !user.totpEnabled || !user.totpSecret) {
            throw new BadRequestException('2FA no está activo');
        }
        if (!this.verify(user.totpSecret, token)) {
            throw new BadRequestException('Código inválido');
        }
        await this.userRepo.update(userId, {
            totpEnabled: false,
            totpSecret: null,
        });
    }

    /** Verifica el token durante el flujo de login. */
    verifyToken(secret: string, token: string): boolean {
        return this.verify(secret, token);
    }

    private verify(secret: string, token: string): boolean {
        const result = otplib.verifySync({
            algorithm: 'sha1',
            digits: 6,
            secret,
            token,
            epochTolerance: EPOCH_TOLERANCE_SECONDS,
        });
        return result.valid;
    }
}
