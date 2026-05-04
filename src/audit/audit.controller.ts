import {
    Controller,
    Get,
    Query,
    DefaultValuePipe,
    ParseIntPipe,
    ParseUUIDPipe,
    ParseEnumPipe,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditAction } from './entities/audit-log.entity';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('audit')
@Roles(UserRole.SUPER_ADMIN)
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    list(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
        @Query('userId', new DefaultValuePipe(undefined)) userId?: string,
        @Query('resource') resource?: string,
        @Query(
            'action',
            new DefaultValuePipe(undefined),
            new ParseEnumPipe(AuditAction, { optional: true }),
        )
        action?: AuditAction,
    ) {
        return this.auditService.list({
            page,
            limit,
            userId,
            resource,
            action,
        });
    }

    @Get('recent')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    recent(
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    ) {
        return this.auditService.listRecent(limit);
    }
}
