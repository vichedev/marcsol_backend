import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReorderItem {
    @IsUUID()
    id!: string;

    @IsInt()
    @Min(0)
    displayOrder!: number;
}

export class ReorderDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ReorderItem)
    items!: ReorderItem[];
}
