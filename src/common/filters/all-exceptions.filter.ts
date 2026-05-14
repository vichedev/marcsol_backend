import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
    statusCode: number;
    message: string | string[];
    error?: string;
    timestamp: string;
    path: string;
}

/**
 * Filtro global. En producción nunca filtra el stack trace ni los detalles de
 * errores internos: devuelve un mensaje genérico y deja la traza completa solo
 * en los logs del servidor.
 *
 * Además: SPA fallback. Para una 404 de un GET que no es de API ni de un
 * asset estático, sirve public/index.html para que el router de React (BrowserRouter)
 * pueda resolver rutas como /login, /dashboard, etc.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter');
    private readonly spaIndexPath = join(process.cwd(), 'public', 'index.html');

    constructor(private readonly configService: ConfigService) { }

    /**
     * Decide si una 404 debe responder con la SPA en vez del JSON de error.
     * Solo aplica a GET/HEAD (las APIs son POST/PATCH/etc), nunca a rutas de
     * API ni a uploads, y solo si el archivo public/index.html existe.
     */
    private shouldFallbackToSpa(request: Request): boolean {
        const method = request.method;
        if (method !== 'GET' && method !== 'HEAD') return false;
        const url = request.url.split('?')[0];
        if (url.startsWith('/api/')) return false;
        if (url.startsWith('/static/')) return false;
        // Archivos que el browser pide directamente (.js, .css, .png, etc) y
        // que no existieron: NO devolvemos index.html (eso confundiría al loader).
        if (/\.[a-z0-9]{2,5}$/i.test(url)) return false;
        return existsSync(this.spaIndexPath);
    }

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const isProduction = this.configService.get<boolean>('isProduction');

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Error interno del servidor';
        let errorName: string | undefined;
        // Propiedades extra que el caller puso en el body del HttpException
        // (ej. `twoFactorRequired: true` en el flujo de login).
        let extras: Record<string, unknown> = {};

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                message = res;
            } else if (typeof res === 'object' && res !== null) {
                const body = res as Record<string, unknown> & {
                    message?: string | string[];
                    error?: string;
                };
                message = (body.message as string | string[] | undefined) ?? exception.message;
                errorName = body.error;
                // Preserva cualquier campo custom (todo excepto los estándar).
                const { message: _m, error: _e, statusCode: _s, ...rest } = body;
                extras = rest;
            } else {
                message = exception.message;
            }
        } else if (exception instanceof Error) {
            // Errores no controlados: log completo, mensaje genérico al cliente en prod.
            this.logger.error(
                `${request.method} ${request.url} → ${exception.message}`,
                exception.stack,
            );
            message = isProduction ? 'Error interno del servidor' : exception.message;
        } else {
            this.logger.error(
                `${request.method} ${request.url} → excepción no estándar`,
                JSON.stringify(exception),
            );
        }

        // SPA fallback: 404 de un GET no-API → servir index.html para que el
        // router de React resuelva /login, /dashboard, etc.
        if (status === HttpStatus.NOT_FOUND && this.shouldFallbackToSpa(request)) {
            response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            response.status(HttpStatus.OK).sendFile(this.spaIndexPath);
            return;
        }

        // Solo logueamos 5xx con stack; 4xx esperados solo a debug
        if (status >= 500) {
            this.logger.error(
                `${request.method} ${request.url} ${status} - ${
                    Array.isArray(message) ? message.join(', ') : message
                }`,
            );
        }

        const body: ErrorResponseBody = {
            statusCode: status,
            message,
            error: errorName,
            timestamp: new Date().toISOString(),
            path: request.url,
            ...extras,
        };

        response.status(status).json(body);
    }
}
