import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { slugify } from '../common/utils/slug.util';

@Injectable()
export class ProductsService {
    constructor(
        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,
    ) { }

    async create(dto: CreateProductDto): Promise<Product> {
        const slug = await this.generateUniqueSlug(dto.name);
        const product = this.productRepository.create({ ...dto, slug });
        try {
            return await this.productRepository.save(product);
        } catch (err: any) {
            if (err.code === '23505') {
                throw new ConflictException('Ya existe un producto similar');
            }
            throw err;
        }
    }

    async findAll(query: QueryProductDto) {
        const {
            categoryId,
            search,
            onlyFeatured,
            minPrice,
            maxPrice,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
            page = 1,
            limit = 12,
        } = query;

        const qb = this.productRepository
            .createQueryBuilder('product')
            .leftJoinAndSelect('product.category', 'category')
            .where('product.isActive = :active', { active: true });

        if (categoryId) {
            qb.andWhere('product.categoryId = :categoryId', { categoryId });
        }
        if (onlyFeatured) {
            qb.andWhere('product.isFeatured = true');
        }
        if (search) {
            qb.andWhere(
                '(product.name ILIKE :search OR product.description ILIKE :search)',
                { search: `%${search}%` },
            );
        }
        if (minPrice !== undefined) {
            qb.andWhere('product.price >= :minPrice', { minPrice });
        }
        if (maxPrice !== undefined) {
            qb.andWhere('product.price <= :maxPrice', { maxPrice });
        }

        // Whitelist de campos por los que podemos ordenar (seguridad)
        const sortableFields = ['createdAt', 'name', 'price'];
        const orderField = sortableFields.includes(sortBy) ? sortBy : 'createdAt';
        qb.orderBy(`product.${orderField}`, sortOrder as 'ASC' | 'DESC');

        qb.skip((page - 1) * limit).take(limit);

        const [items, total] = await qb.getManyAndCount();

        return {
            items,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /** Versión para el dashboard: incluye inactivos */
    async findAllAdmin() {
        return this.productRepository.find({
            relations: ['category'],
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string): Promise<Product> {
        const product = await this.productRepository.findOne({
            where: { id },
            relations: ['category'],
        });
        if (!product) {
            throw new NotFoundException('Producto no encontrado');
        }
        return product;
    }

    async update(id: string, dto: UpdateProductDto): Promise<Product> {
        const product = await this.productRepository.findOne({ where: { id } });
        if (!product) {
            throw new NotFoundException('Producto no encontrado');
        }
        if (dto.name && dto.name !== product.name) {
            product.slug = await this.generateUniqueSlug(dto.name, id);
        }
        Object.assign(product, dto);
        return this.productRepository.save(product);
    }

    async remove(id: string): Promise<void> {
        const result = await this.productRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException('Producto no encontrado');
        }
    }

    private async generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
        const base = slugify(name);
        let slug = base;
        let counter = 1;
        while (true) {
            const existing = await this.productRepository.findOne({ where: { slug } });
            if (!existing || existing.id === excludeId) return slug;
            slug = `${base}-${counter++}`;
        }
    }
}