import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { Category } from '../categories/entities/category.entity';
import { ProductsService } from './products.service';
import { ProductImagesService } from './product-images.service';
import { ProductsImportService } from './products-import.service';
import { ProductsController } from './products.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Product, ProductImage, Category])],
    controllers: [ProductsController],
    providers: [ProductsService, ProductImagesService, ProductsImportService],
    exports: [ProductsService],
})
export class ProductsModule { }
