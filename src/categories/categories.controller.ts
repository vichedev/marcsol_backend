import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MoveCategoryDto } from './dto/move-category.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @Public()
    @Get()
    findAll(@Query('onlyActive') onlyActive?: string) {
        return this.categoriesService.findAll(onlyActive === 'true');
    }

    @Public()
    @Get('tree')
    findTree(@Query('onlyActive') onlyActive?: string) {
        return this.categoriesService.findTree(onlyActive === 'true');
    }

    @Public()
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.categoriesService.findOne(id);
    }

    @Post()
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    create(@Body() dto: CreateCategoryDto) {
        return this.categoriesService.create(dto);
    }

    @Patch(':id/move')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    move(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: MoveCategoryDto,
    ) {
        return this.categoriesService.move(id, dto);
    }

    @Patch(':id')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCategoryDto,
    ) {
        return this.categoriesService.update(id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.categoriesService.remove(id);
    }
}
