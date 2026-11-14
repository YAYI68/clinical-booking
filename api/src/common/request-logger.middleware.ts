import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { APP_CONFIG, AppConfig } from '../config';

/** Logs the path only, so emails in query strings stay out of logs. */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.config.logRequests) return next();
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const line = `${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(1)}ms`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}
