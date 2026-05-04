import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { Promotion } from '../promotions/entities/promotion.entity';
import { Advertisement } from '../advertisements/entities/advertisement.entity';
import { User } from '../users/entities/user.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Product,
            Category,
            Promotion,
            Advertisement,
            User,
        ]),
    ],
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule { }
