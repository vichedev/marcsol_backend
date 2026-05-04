import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter');

    constructor(private readonly configService: ConfigService) { }

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
