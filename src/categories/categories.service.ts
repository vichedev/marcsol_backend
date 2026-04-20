import {
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { slugify } from '../common/utils/slug.util';

@Injectable()
export class CategoriesService {
    constructor(
        @InjectRepository(Category)
        private readonly categoryRepository: Repository<Category>,
    ) { }

    async create(dto: CreateCategoryDto): Promise<Category> {
        const slug = slugify(dto.name);
        const existing = await this.categoryRepository.findOne({
            where: [{ name: dto.name }, { slug }],
        });
        if (existing) {
            throw new ConflictException('Ya existe una categoría con ese nombre');
        }
        const category: Category = this.categoryRepository.create({
            ...dto,
            slug,
        });
        return this.categoryRepository.save(category);
    }

    findAll(onlyActive = false): Promise<Category[]> {
        return this.categoryRepository.find({
            where: onlyActive ? { isActive: true } : {},
            order: { name: 'ASC' },
        });
    }

    async findOne(id: string): Promise<Category> {
        const category = await this.categoryRepository.findOne({
            where: { id },
            relations: ['products'],
        });
        if (!category) {
            throw new NotFoundException('Categoría no encontrada');
        }
        return category;
    }

    async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
        const category = await this.categoryRepository.findOne({ where: { id } });
        if (!category) {
            throw new NotFoundException('Categoría no encontrada');
        }
        if (dto.name && dto.name !== category.name) {
            category.slug = slugify(dto.name);
        }
        Object.assign(category, dto);
        return this.categoryRepository.save(category);
    }

    async remove(id: string): Promise<void> {
        const result = await this.categoryRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException('Categoría no encontrada');
        }
    }
}