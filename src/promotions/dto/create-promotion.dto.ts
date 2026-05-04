import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PromotionLayout } from '../entities/promotion.entity';

export class CreatePromotionDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    title: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsString()
    @IsNotEmpty()
    imageUrl: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    ctaText?: string;

    @IsOptional()
    @IsString()
    ctaLink?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    displayOrder?: number;

    @IsOptional()
    @IsEnum(PromotionLayout)
    layout?: PromotionLayout;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}