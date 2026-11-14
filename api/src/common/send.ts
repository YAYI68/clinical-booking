import type { Response } from 'express';
import { ApiResult } from './api-error';

export function send<T>(res: Response, result: ApiResult<T>): T {
  res.status(result.status);
  for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
  return result.body;
}
