import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { AutoSeedService } from './auto-seed.service';

@Module({
    imports: [TypeOrmModule.forFeature([User])],
    providers: [AutoSeedService],
})
export class SeedsModule { }