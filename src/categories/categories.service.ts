import {
    BadRequestException,
    Injectable,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MoveCategoryDto } from './dto/move-category.dto';
import { slugify } from '../common/utils/slug.util';

export interface CategoryNode extends Category {
    children: CategoryNode[];
    productCount?: number;
}

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

        if (dto.parentId) {
            const parentExists = await this.categoryRepository.exist({
                where: { id: dto.parentId },
            });
            if (!parentExists) {
                throw new NotFoundException('La categoría padre no existe');
            }
        }

        const category = this.categoryRepository.create({
            ...dto,
            slug,
            parentId: dto.parentId ?? null,
        });
        return this.categoryRepository.save(category);
    }

    findAll(onlyActive = false): Promise<Category[]> {
        return this.categoryRepository.find({
            where: onlyActive ? { isActive: true } : {},
            order: { sortOrder: 'ASC', name: 'ASC' },
        });
    }

    /**
     * Devuelve el árbol completo. La construcción es O(n) en memoria a partir
     * de un único query.
     */
    async findTree(onlyActive = false): Promise<CategoryNode[]> {
        const all = await this.categoryRepository.find({
            where: onlyActive ? { isActive: true } : {},
            order: { sortOrder: 'ASC', name: 'ASC' },
        });
        const map = new Map<string, CategoryNode>();
        all.forEach((c) => map.set(c.id, { ...c, children: [] } as CategoryNode));
        const roots: CategoryNode[] = [];
        for (const node of map.values()) {
            if (node.parentId && map.has(node.parentId)) {
                map.get(node.parentId)!.children.push(node);
            } else {
                roots.push(node);
            }
        }
        return roots;
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
        if (dto.parentId !== undefined && dto.parentId !== category.parentId) {
            await this.assertNoCycle(id, dto.parentId);
        }
        Object.assign(category, dto);
        return this.categoryRepository.save(category);
    }

    async move(id: string, dto: MoveCategoryDto): Promise<Category> {
        const category = await this.categoryRepository.findOne({ where: { id } });
        if (!category) {
            throw new NotFoundException('Categoría no encontrada');
        }
        if (dto.parentId !== undefined) {
            await this.assertNoCycle(id, dto.parentId);
            category.parentId = dto.parentId;
        }
        if (dto.sortOrder !== undefined) {
            category.sortOrder = dto.sortOrder;
        }
        return this.categoryRepository.save(category);
    }

    async remove(id: string): Promise<void> {
        // Las hijas quedan huérfanas (parentId null) gracias al ON DELETE SET NULL.
        const result = await this.categoryRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException('Categoría no encontrada');
        }
    }

    /**
     * Evita ciclos: el nuevo padre no puede ser la propia categoría
     * ni ningún descendiente suyo.
     */
    private async assertNoCycle(
        id: string,
        newParentId: string | null | undefined,
    ): Promise<void> {
        if (!newParentId) return;
        if (newParentId === id) {
            throw new BadRequestException('Una categoría no puede ser su propio padre');
        }
        // BFS hacia arriba desde newParentId: si llegamos a `id`, hay ciclo.
        let cursor: string | null = newParentId;
        const visited = new Set<string>();
        while (cursor) {
            if (cursor === id) {
                throw new BadRequestException(
                    'No puedes mover una categoría dentro de sus propias subcategorías',
                );
            }
            if (visited.has(cursor)) break;
            visited.add(cursor);
            const parent = await this.categoryRepository.findOne({
                where: { id: cursor },
                select: ['id', 'parentId'],
            });
            cursor = parent?.parentId ?? null;
        }
    }
}
