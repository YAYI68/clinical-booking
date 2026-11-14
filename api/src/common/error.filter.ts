import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError } from './api-error';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiError) {
      res.status(exception.status).json({ error: exception.message });
      return;
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      let message = exception.message;
      if (typeof body === 'object' && body && 'message' in body) {
        const m = (body as { message: unknown }).message;
        message = Array.isArray(m) ? m.join(', ') : String(m);
      }
      res.status(exception.getStatus()).json({ error: message });
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({ error: 'internal server error' });
  }
}
