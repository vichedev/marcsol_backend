import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { AdvertisementsService } from './advertisements.service';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';
import { AdPosition } from './entities/advertisement.entity';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('advertisements')
export class AdvertisementsController {
    constructor(private readonly adsService: AdvertisementsService) { }

    // Público: la web pública consulta por posición
    @Public()
    @Get('active')
    findActive(@Query('position') position?: AdPosition) {
        return this.adsService.findActiveByPosition(position);
    }

    // Admin: todos
    @Get()
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    findAllAdmin() {
        return this.adsService.findAllAdmin();
    }

    @Get(':id')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.adsService.findOne(id);
    }

    @Post()
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    create(@Body() dto: CreateAdvertisementDto) {
        return this.adsService.create(dto);
    }

    @Patch(':id')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateAdvertisementDto,
    ) {
        return this.adsService.update(id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.adsService.remove(id);
    }
}