import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AdPosition, BadgeColor } from '../entities/advertisement.entity';

export class CreateAdvertisementDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    title: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    subtitle?: string;

    @IsString()
    @IsNotEmpty()
    imageUrl: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    badgeText?: string;

    @IsOptional()
    @IsEnum(BadgeColor)
    badgeColor?: BadgeColor;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    ctaText?: string;

    @IsOptional()
    @IsString()
    link?: string;

    @IsOptional()
    @IsEnum(AdPosition)
    position?: AdPosition;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    displayOrder?: number;
}