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
    Res,
    UploadedFile,
    UseInterceptors,
    BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { ProductsImportService } from './products-import.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('products')
export class ProductsController {
    constructor(
        private readonly productsService: ProductsService,
        private readonly productsImportService: ProductsImportService,
    ) { }

    // ─── Endpoints de importación (antes de los :id genéricos) ───

    @Get('import/template')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    async downloadTemplate(
        @Res() res: Response,
        @Query('images') imagesRaw?: string,
    ) {
        // Parsear la lista de nombres de imágenes
        let imageNames: string[] = [];
        if (imagesRaw) {
            try {
                imageNames = JSON.parse(imagesRaw);
                if (!Array.isArray(imageNames)) imageNames = [];
            } catch {
                imageNames = [];
            }
        }

        const buffer = await this.productsImportService.generateTemplate(imageNames);
        res.set({
            'Content-Type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition':
                'attachment; filename="plantilla-productos-marcsol.xlsx"',
        });
        res.send(buffer);
    }

    @Post('import')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    async importProducts(
        @UploadedFile() file: Express.Multer.File,
        @Body('imageMap') imageMapRaw?: string,
    ) {
        if (!file) {
            throw new BadRequestException('Debes adjuntar un archivo Excel');
        }
        if (
            !file.originalname.toLowerCase().endsWith('.xlsx') &&
            !file.originalname.toLowerCase().endsWith('.xls')
        ) {
            throw new BadRequestException('El archivo debe ser un Excel (.xlsx)');
        }

        // El imageMap viene como JSON string en el formData
        let imageMap: Record<string, string> = {};
        if (imageMapRaw) {
            try {
                imageMap = JSON.parse(imageMapRaw);
            } catch {
                throw new BadRequestException('imageMap debe ser un JSON válido');
            }
        }

        return this.productsImportService.importFromExcel(file.buffer, imageMap);
    }

    // ─── Endpoints admin sin parámetros dinámicos ───

    @Get('admin/all')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    findAllAdmin() {
        return this.productsService.findAllAdmin();
    }

    // ─── Endpoints públicos ───

    @Public()
    @Get()
    findAll(@Query() query: QueryProductDto) {
        return this.productsService.findAll(query);
    }

    @Public()
    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.productsService.findOne(id);
    }

    // ─── Endpoints de escritura ───

    @Post()
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    create(@Body() dto: CreateProductDto) {
        return this.productsService.create(dto);
    }

    @Patch(':id')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateProductDto,
    ) {
        return this.productsService.update(id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.productsService.remove(id);
    }
}