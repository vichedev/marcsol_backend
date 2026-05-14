import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    /**
     * Endpoint PÚBLICO. La SPA pública lo consume para pintar info de contacto
     * y para inicializar EmailJS. La PublicKey de EmailJS es pública por diseño
     * (va en todo bundle de cliente), así que no es secreto exponerla aquí.
     */
    @Public()
    @Get()
    get() {
        return this.settingsService.get();
    }

    @Patch()
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    update(@Body() dto: UpdateSiteSettingsDto) {
        return this.settingsService.update(dto);
    }
}
