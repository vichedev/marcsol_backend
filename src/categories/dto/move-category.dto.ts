import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MoveCategoryDto {
    /** Padre destino (null para raíz). */
    @IsOptional()
    @IsUUID()
    parentId?: string | null;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    sortOrder?: number;
}
