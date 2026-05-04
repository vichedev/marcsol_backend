import { BadRequestException, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { existsSync, mkdirSync } from 'fs';
import { UploadsController } from './uploads.controller';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_MIMETYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
];

@Module({
    imports: [
        MulterModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const dest = config.get<string>('upload.dest') ?? './uploads';
                if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

                return {
                    storage: diskStorage({
                        destination: dest,
                        filename: (_req, file, cb) => {
                            const ext = extname(file.originalname).toLowerCase();
                            cb(null, `${uuid()}${ext}`);
                        },
                    }),
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
                    limits: {
                        fileSize:
                            config.get<number>('upload.maxSize') ?? 5 * 1024 * 1024,
                        files: 50,
                    },
                };
            },
        }),
    ],
    controllers: [UploadsController],
})
export class UploadsModule { }
