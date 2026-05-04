import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Patch,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { IsString, Length, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { TwoFactorService } from './twofa.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

class ChangePasswordDto {
    @IsString()
    @MinLength(1)
    oldPassword!: string;

    @IsString()
    @MinLength(8, {
        message: 'La nueva contraseña debe tener al menos 8 caracteres',
    })
    newPassword!: string;
}

class TwoFactorTokenDto {
    @IsString()
    @Length(6, 6, { message: 'El código debe tener 6 dígitos' })
    token!: string;
}

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly twoFactorService: TwoFactorService,
    ) { }

    @Public()
    @Throttle({ default: { ttl: 60_000, limit: 5 } })
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() loginDto: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { user } = await this.authService.login(loginDto, res, req);
        return { user };
    }

    @Public()
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const user = (req as Request & { user?: AuthUser }).user;
        await this.authService.logout(res, user?.id, user?.email);
        return { ok: true };
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: AuthUser) {
        return user;
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    profile(@CurrentUser() user: AuthUser) {
        return user;
    }

    @UseGuards(JwtAuthGuard)
    @Patch('profile')
    updateProfile(
        @CurrentUser() user: AuthUser,
        @Body() dto: UpdateProfileDto,
    ) {
        return this.authService.updateProfile(user.id, dto);
    }

    @UseGuards(JwtAuthGuard)
    @Throttle({ default: { ttl: 60_000, limit: 10 } })
    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    changePassword(
        @CurrentUser() user: AuthUser,
        @Body() dto: ChangePasswordDto,
    ) {
        return this.authService.changeOwnPassword(
            user.id,
            dto.oldPassword,
            dto.newPassword,
        );
    }

    // ─── 2FA ───
    @UseGuards(JwtAuthGuard)
    @Post('2fa/setup')
    @HttpCode(HttpStatus.OK)
    setup2fa(@CurrentUser() user: AuthUser) {
        return this.twoFactorService.beginSetup(user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Post('2fa/verify')
    @HttpCode(HttpStatus.OK)
    async verify2fa(
        @CurrentUser() user: AuthUser,
        @Body() dto: TwoFactorTokenDto,
    ) {
        await this.twoFactorService.verifyAndEnable(user.id, dto.token);
        return { enabled: true };
    }

    @UseGuards(JwtAuthGuard)
    @Post('2fa/disable')
    @HttpCode(HttpStatus.OK)
    async disable2fa(
        @CurrentUser() user: AuthUser,
        @Body() dto: TwoFactorTokenDto,
    ) {
        await this.twoFactorService.disable(user.id, dto.token);
        return { enabled: false };
    }
}
