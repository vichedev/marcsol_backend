import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdPosition, Advertisement } from './entities/advertisement.entity';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';

@Injectable()
export class AdvertisementsService {
    constructor(
        @InjectRepository(Advertisement)
        private readonly adRepository: Repository<Advertisement>,
    ) { }

    async create(dto: CreateAdvertisementDto): Promise<Advertisement> {
        const ad: Advertisement = this.adRepository.create(dto);
        return this.adRepository.save(ad);
    }

    findAllAdmin(): Promise<Advertisement[]> {
        return this.adRepository.find({
            order: { position: 'ASC', displayOrder: 'ASC' },
        });
    }

    /** Públicos: activos filtrados por posición opcional */
    findActiveByPosition(position?: AdPosition): Promise<Advertisement[]> {
        return this.adRepository.find({
            where: {
                isActive: true,
                ...(position ? { position } : {}),
            },
            order: { displayOrder: 'ASC' },
        });
    }

    async findOne(id: string): Promise<Advertisement> {
        const ad = await this.adRepository.findOne({ where: { id } });
        if (!ad) {
            throw new NotFoundException('Publicidad no encontrada');
        }
        return ad;
    }

    async update(id: string, dto: UpdateAdvertisementDto): Promise<Advertisement> {
        const ad = await this.adRepository.findOne({ where: { id } });
        if (!ad) {
            throw new NotFoundException('Publicidad no encontrada');
        }
        Object.assign(ad, dto);
        return this.adRepository.save(ad);
    }

    async remove(id: string): Promise<void> {
        const result = await this.adRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException('Publicidad no encontrada');
        }
    }
}