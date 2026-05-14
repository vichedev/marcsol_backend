import {
    Injectable,
    Logger,
    OnApplicationBootstrap,
    ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSettings } from './entities/site-settings.entity';
import { UpdateSiteSettingsDto } from './dto/update-site-settings.dto';

const SINGLETON_ID = 1;
/** Código SQLSTATE de Postgres para "undefined_table". */
const PG_UNDEFINED_TABLE = '42P01';

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SettingsService.name);

    constructor(
        @InjectRepository(SiteSettings)
        private readonly repo: Repository<SiteSettings>,
    ) { }

    /**
     * Garantiza la fila singleton al boot. Si la tabla todavía no existe
     * (porque la migración no ha corrido), solo lo logueamos en lugar de
     * tirar la app: la migración crea la fila por sí misma con INSERT.
     */
    async onApplicationBootstrap(): Promise<void> {
        try {
            const existing = await this.repo.findOne({ where: { id: SINGLETON_ID } });
            if (!existing) {
                await this.repo.save(this.repo.create({ id: SINGLETON_ID }));
                this.logger.log('Fila singleton de site_settings inicializada.');
            }
        } catch (err) {
            if (this.isMissingTable(err)) {
                this.logger.warn(
                    'Tabla site_settings no existe aún. ' +
                    'Ejecuta las migraciones: npm run migration:run',
                );
                return;
            }
            throw err;
        }
    }

    /** Devuelve la fila singleton. Crea si no existe; falla limpio si no hay tabla. */
    async get(): Promise<SiteSettings> {
        try {
            let row = await this.repo.findOne({ where: { id: SINGLETON_ID } });
            if (!row) {
                row = await this.repo.save(this.repo.create({ id: SINGLETON_ID }));
            }
            return row;
        } catch (err) {
            if (this.isMissingTable(err)) {
                throw new ServiceUnavailableException(
                    'La configuración del sitio aún no está disponible. Ejecuta las migraciones.',
                );
            }
            throw err;
        }
    }

    /**
     * Aplica un patch. Convierte strings vacíos a null para que la BD no
     * guarde "" cuando el admin quiere limpiar un campo.
     */
    async update(dto: UpdateSiteSettingsDto): Promise<SiteSettings> {
        const row = await this.get();
        const patch: Record<string, string | null> = {};
        for (const [key, value] of Object.entries(dto)) {
            patch[key] = value === '' ? null : (value as string | null);
        }
        Object.assign(row, patch);
        return this.repo.save(row);
    }

    private isMissingTable(err: unknown): boolean {
        return (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code?: string }).code === PG_UNDEFINED_TABLE
        );
    }
}
