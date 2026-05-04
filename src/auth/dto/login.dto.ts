import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
} from 'class-validator';

export class LoginDto {
    @IsEmail({}, { message: 'Email inválido' })
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    /** Código TOTP si la cuenta tiene 2FA habilitado. */
    @IsOptional()
    @IsString()
    @Length(6, 6, { message: 'El código de 2FA debe tener 6 dígitos' })
    totpCode?: string;
}
