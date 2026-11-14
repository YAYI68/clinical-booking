import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { APP_CONFIG, AppConfig } from '../config';
import { ApiError } from './api-error';
import { IS_PUBLIC } from './public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.expected = Buffer.from(config.apiKey);
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const header = context.switchToHttp().getRequest<Request>().headers['x-api-key'];
    if (typeof header !== 'string' || header.length === 0) throw new ApiError(401, 'missing API key');

    const given = Buffer.from(header);
    if (given.length !== this.expected.length || !timingSafeEqual(given, this.expected)) {
      throw new ApiError(401, 'invalid API key');
    }
    return true;
  }
}
