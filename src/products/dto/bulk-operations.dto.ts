import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsObject,
    IsOptional,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BulkPatch {
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsBoolean()
    isFeatured?: boolean;

    @IsOptional()
    @IsUUID()
    categoryId?: string;
}

export class BulkUpdateDto {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(500)
    @IsUUID(undefined, { each: true })
    ids!: string[];

    @IsObject()
    @ValidateNested()
    @Type(() => BulkPatch)
    patch!: BulkPatch;
}

export class BulkDeleteDto {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(500)
    @IsUUID(undefined, { each: true })
    ids!: string[];
}
