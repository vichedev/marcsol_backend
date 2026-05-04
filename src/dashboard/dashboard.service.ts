import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Product, ProductStatus } from '../products/entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { Promotion } from '../promotions/entities/promotion.entity';
import { Advertisement } from '../advertisements/entities/advertisement.entity';
import { User } from '../users/entities/user.entity';

export interface DashboardStats {
    products: {
        total: number;
        active: number;
        featured: number;
        draft: number;
        scheduled: number;
        archived: number;
        withoutImage: number;
        withoutPrice: number;
        withoutCategory: number;
    };
    catalogHealth: {
        scorePct: number;
        signals: Array<{
            label: string;
            ok: number;
            total: number;
            pct: number;
        }>;
    };
    categories: {
        total: number;
        active: number;
        empty: number;
    };
    promotions: {
        total: number;
        activeNow: number;
        expiringIn7d: number;
        scheduled: number;
    };
    ads: {
        total: number;
        active: number;
        byPosition: Record<string, number>;
    };
    users: {
        total: number;
        active: number;
    };
}

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(Product)
        private readonly productRepo: Repository<Product>,
        @InjectRepository(Category)
        private readonly categoryRepo: Repository<Category>,
        @InjectRepository(Promotion)
        private readonly promotionRepo: Repository<Promotion>,
        @InjectRepository(Advertisement)
        private readonly adRepo: Repository<Advertisement>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    async getStats(): Promise<DashboardStats> {
        const now = new Date();
        const in7d = new Date(now.getTime() + 7 * 86_400_000);

        const [
            totalProducts,
            activeProducts,
            featuredProducts,
            draftProducts,
            scheduledProducts,
            archivedProducts,
            withoutImage,
            withoutPrice,
            withoutCategory,
            withDescription,
            totalCategories,
            activeCategories,
            emptyCategories,
            totalPromos,
            scheduledPromos,
            totalAds,
            activeAds,
            adsList,
            totalUsers,
            activeUsers,
        ] = await Promise.all([
            this.productRepo.count(),
            this.productRepo.count({ where: { isActive: true } }),
            this.productRepo.count({ where: { isFeatured: true } }),
            this.productRepo.count({ where: { status: ProductStatus.DRAFT } }),
            this.productRepo.count({ where: { status: ProductStatus.SCHEDULED } }),
            this.productRepo.count({ where: { status: ProductStatus.ARCHIVED } }),
            this.productRepo.count({ where: { imageUrl: '' } }),
            this.productRepo.count({ where: { price: IsNull() } }),
            this.productRepo.count({ where: { categoryId: IsNull() } }),
            this.productRepo
                .createQueryBuilder('p')
                .where('LENGTH(p.description) >= :n', { n: 50 })
                .getCount(),
            this.categoryRepo.count(),
            this.categoryRepo.count({ where: { isActive: true } }),
            this.categoryRepo
                .createQueryBuilder('c')
                .leftJoin('c.products', 'p')
                .where('p.id IS NULL')
                .getCount(),
            this.promotionRepo.count(),
            this.promotionRepo.count({
                where: { startDate: MoreThanOrEqual(now) },
            }),
            this.adRepo.count(),
            this.adRepo.count({ where: { isActive: true } }),
            this.adRepo.find({
                select: ['position', 'isActive'],
            }),
            this.userRepo.count(),
            this.userRepo.count({ where: { isActive: true } }),
        ]);

        // Promociones activas ahora: isActive + ventana de fechas válida.
        const activePromos = await this.promotionRepo
            .createQueryBuilder('p')
            .where('p.isActive = true')
            .andWhere('(p.startDate IS NULL OR p.startDate <= :now)', { now })
            .andWhere('(p.endDate IS NULL OR p.endDate >= :now)', { now })
            .getCount();

        // Promociones que expiran en los próximos 7 días.
        const expiringPromos = await this.promotionRepo
            .createQueryBuilder('p')
            .where('p.isActive = true')
            .andWhere('p.endDate IS NOT NULL')
            .andWhere('p.endDate BETWEEN :now AND :in7d', { now, in7d })
            .getCount();

        // Salud del catálogo: porcentaje de productos "completos".
        const totalForHealth = totalProducts || 1;
        const signals = [
            {
                label: 'Con imagen',
                ok: totalProducts - withoutImage,
                total: totalProducts,
                pct: Math.round(
                    ((totalProducts - withoutImage) / totalForHealth) * 100,
                ),
            },
            {
                label: 'Con precio',
                ok: totalProducts - withoutPrice,
                total: totalProducts,
                pct: Math.round(
                    ((totalProducts - withoutPrice) / totalForHealth) * 100,
                ),
            },
            {
                label: 'Con categoría',
                ok: totalProducts - withoutCategory,
                total: totalProducts,
                pct: Math.round(
                    ((totalProducts - withoutCategory) / totalForHealth) * 100,
                ),
            },
            {
                label: 'Descripción ≥ 50 chars',
                ok: withDescription,
                total: totalProducts,
                pct: Math.round((withDescription / totalForHealth) * 100),
            },
        ];
        const scorePct = totalProducts === 0
            ? 0
            : Math.round(
                signals.reduce((acc, s) => acc + s.pct, 0) / signals.length,
            );

        const byPosition = adsList.reduce<Record<string, number>>((acc, ad) => {
            if (ad.isActive) {
                acc[ad.position] = (acc[ad.position] ?? 0) + 1;
            }
            return acc;
        }, {});

        return {
            products: {
                total: totalProducts,
                active: activeProducts,
                featured: featuredProducts,
                draft: draftProducts,
                scheduled: scheduledProducts,
                archived: archivedProducts,
                withoutImage,
                withoutPrice,
                withoutCategory,
            },
            catalogHealth: { scorePct, signals },
            categories: {
                total: totalCategories,
                active: activeCategories,
                empty: emptyCategories,
            },
            promotions: {
                total: totalPromos,
                activeNow: activePromos,
                expiringIn7d: expiringPromos,
                scheduled: scheduledPromos,
            },
            ads: {
                total: totalAds,
                active: activeAds,
                byPosition,
            },
            users: {
                total: totalUsers,
                active: activeUsers,
            },
        };
    }
}
