import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    UploadedFiles,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_MIMETYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
];

/**
 * Limpia el nombre del archivo para evitar path traversal y caracteres extraños
 * en el JSON de respuesta. No se usa en el filesystem; solo como alias para el
 * frontend (Excel imageMap).
 */
function sanitizeFilename(name: string): string {
    return basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

@Controller('uploads')
export class UploadsController {
    @Post('image')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    uploadImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No se envió ningún archivo');
        }
        return {
            filename: file.filename,
            url: `/static/${file.filename}`,
            size: file.size,
            mimetype: file.mimetype,
        };
    }

    @Post('images/bulk')
    @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
    @UseInterceptors(
        FilesInterceptor('files', 50, {
            storage: diskStorage({
                destination: './uploads',
                filename: (_req, file, cb) => {
                    const ext = extname(file.originalname).toLowerCase();
                    cb(null, `${uuidv4()}${ext}`);
                },
            }),
            limits: { fileSize: 5 * 1024 * 1024, files: 50 },
            fileFilter: (_req, file, cb) => {
                const ext = extname(file.originalname).toLowerCase();
                if (
                    !ALLOWED_EXTENSIONS.includes(ext) ||
                    !ALLOWED_MIMETYPES.includes(file.mimetype)
                ) {
                    return cb(
                        new BadRequestException(
                            'Solo se permiten imágenes (jpg, png, webp, gif)',
                        ),
                        false,
                    );
                }
                cb(null, true);
            },
        }),
    )
    uploadMultipleImages(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('Debes adjuntar al menos una imagen');
        }

        const result: Record<string, string> = {};
        for (const file of files) {
            const safeKey = sanitizeFilename(file.originalname);
            result[safeKey] = `/static/${file.filename}`;
        }

        return {
            count: files.length,
            images: result,
        };
    }
}
