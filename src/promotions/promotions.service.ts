import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ReorderDto } from '../common/dto/reorder.dto';
import { Promotion } from './entities/promotion.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Injectable()
export class PromotionsService {
    constructor(
        @InjectRepository(Promotion)
        private readonly promotionRepository: Repository<Promotion>,
        private readonly dataSource: DataSource,
    ) { }

    async reorder(dto: ReorderDto): Promise<{ affected: number }> {
        const ids = dto.items.map((i) => i.id);
        const found = await this.promotionRepository.count({
            where: { id: In(ids) },
        });
        if (found !== ids.length) {
            throw new NotFoundException(
                'Una o más promociones del lote no existen',
            );
        }
        await this.dataSource.transaction(async (manager) => {
            for (const item of dto.items) {
                await manager.update(Promotion, item.id, {
                    displayOrder: item.displayOrder,
                });
            }
        });
        return { affected: ids.length };
    }

    async create(dto: CreatePromotionDto): Promise<Promotion> {
        const promotion: Promotion = this.promotionRepository.create(dto);
        return this.promotionRepository.save(promotion);
    }

    /** Todas las promociones para el dashboard admin (activas + inactivas) */
    findAllAdmin(): Promise<Promotion[]> {
        return this.promotionRepository.find({
            order: { displayOrder: 'ASC', createdAt: 'DESC' },
        });
    }

    /**
     * Promociones activas para el hero público.
     * Filtra por isActive + ventana de fechas (startDate/endDate si existen).
     */
    async findActive(): Promise<Promotion[]> {
        const now = new Date();
        const qb = this.promotionRepository
            .createQueryBuilder('p')
            .where('p.isActive = :active', { active: true })
            .andWhere('(p.startDate IS NULL OR p.startDate <= :now)', { now })
            .andWhere('(p.endDate IS NULL OR p.endDate >= :now)', { now })
            .orderBy('p.displayOrder', 'ASC')
            .addOrderBy('p.createdAt', 'DESC');
        return qb.getMany();
    }

    async findOne(id: string): Promise<Promotion> {
        const promotion = await this.promotionRepository.findOne({ where: { id } });
        if (!promotion) {
            throw new NotFoundException('Promoción no encontrada');
        }
        return promotion;
    }

    async update(id: string, dto: UpdatePromotionDto): Promise<Promotion> {
        const promotion = await this.promotionRepository.findOne({ where: { id } });
        if (!promotion) {
            throw new NotFoundException('Promoción no encontrada');
        }
        Object.assign(promotion, dto);
        return this.promotionRepository.save(promotion);
    }

    async remove(id: string): Promise<void> {
        const result = await this.promotionRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException('Promoción no encontrada');
        }
    }
}