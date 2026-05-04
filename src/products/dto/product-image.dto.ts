import {
    ArrayMinSize,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddProductImageDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    url!: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    alt?: string;
}

class ReorderItem {
    @IsUUID()
    id!: string;

    @IsInt()
    @Min(0)
    sortOrder!: number;
}

export class ReorderProductImagesDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ReorderItem)
    items!: ReorderItem[];
}

export class UpdateProductImageDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    alt?: string;
}
