import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import {
    AddProductImageDto,
    ReorderProductImagesDto,
    UpdateProductImageDto,
} from './dto/product-image.dto';

@Injectable()
export class ProductImagesService {
    constructor(
        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,
        @InjectRepository(ProductImage)
        private readonly imageRepository: Repository<ProductImage>,
        private readonly dataSource: DataSource,
    ) { }

    async list(productId: string): Promise<ProductImage[]> {
        await this.assertProductExists(productId);
        return this.imageRepository.find({
            where: { productId },
            order: { sortOrder: 'ASC', createdAt: 'ASC' },
        });
    }

    async add(productId: string, dto: AddProductImageDto): Promise<ProductImage> {
        await this.assertProductExists(productId);
        const last = await this.imageRepository.findOne({
            where: { productId },
            order: { sortOrder: 'DESC' },
        });
        const sortOrder = last ? last.sortOrder + 1 : 0;
        const total = await this.imageRepository.count({ where: { productId } });
        const isPrimary = total === 0;

        const image = this.imageRepository.create({
            productId,
            url: dto.url,
            alt: dto.alt ?? null,
            sortOrder,
            isPrimary,
        });
        const saved = await this.imageRepository.save(image);

        if (isPrimary) {
            await this.productRepository.update(productId, { imageUrl: saved.url });
        }
        return saved;
    }

    async update(
        productId: string,
        imageId: string,
        dto: UpdateProductImageDto,
    ): Promise<ProductImage> {
        const image = await this.assertImage(productId, imageId);
        Object.assign(image, dto);
        return this.imageRepository.save(image);
    }

    async remove(productId: string, imageId: string): Promise<void> {
        const image = await this.assertImage(productId, imageId);
        await this.dataSource.transaction(async (manager) => {
            await manager.delete(ProductImage, { id: imageId });
            if (image.isPrimary) {
                // Promueve la siguiente imagen (menor sortOrder) como primaria.
                const next = await manager.findOne(ProductImage, {
                    where: { productId },
                    order: { sortOrder: 'ASC' },
                });
                if (next) {
                    await manager.update(ProductImage, next.id, { isPrimary: true });
                    await manager.update(Product, productId, { imageUrl: next.url });
                } else {
                    // Sin imágenes — el storefront mostrará "sin foto".
                    await manager.update(Product, productId, { imageUrl: '' });
                }
            }
        });
    }

    async setPrimary(productId: string, imageId: string): Promise<ProductImage> {
        const image = await this.assertImage(productId, imageId);
        await this.dataSource.transaction(async (manager) => {
            await manager.update(
                ProductImage,
                { productId },
                { isPrimary: false },
            );
            await manager.update(ProductImage, imageId, { isPrimary: true });
            await manager.update(Product, productId, { imageUrl: image.url });
        });
        return { ...image, isPrimary: true };
    }

    async reorder(
        productId: string,
        dto: ReorderProductImagesDto,
    ): Promise<ProductImage[]> {
        await this.assertProductExists(productId);
        const ids = dto.items.map((i) => i.id);
        const found = await this.imageRepository.find({
            where: { productId },
        });
        const validIds = new Set(found.map((i) => i.id));
        for (const id of ids) {
            if (!validIds.has(id)) {
                throw new NotFoundException(
                    `La imagen ${id} no pertenece al producto`,
                );
            }
        }

        await this.dataSource.transaction(async (manager) => {
            for (const item of dto.items) {
                await manager.update(ProductImage, item.id, {
                    sortOrder: item.sortOrder,
                });
            }
        });

        return this.imageRepository.find({
            where: { productId },
            order: { sortOrder: 'ASC' },
        });
    }

    private async assertProductExists(productId: string): Promise<void> {
        const exists = await this.productRepository.exist({
            where: { id: productId },
        });
        if (!exists) {
            throw new NotFoundException('Producto no encontrado');
        }
    }

    private async assertImage(
        productId: string,
        imageId: string,
    ): Promise<ProductImage> {
        const image = await this.imageRepository.findOne({
            where: { id: imageId, productId },
        });
        if (!image) {
            throw new NotFoundException('Imagen no encontrada');
        }
        return image;
    }
}
