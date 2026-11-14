/** Returned (not thrown) so responses can be replayed for idempotency. */
export interface ApiResult<T = unknown> {
  status: number;
  body: T;
  headers?: Record<string, string>;
}

export const ok = <T>(body: T, status = 200): ApiResult<T> => ({ status, body });

export const fail = (status: number, error: string, headers?: Record<string, string>): ApiResult<{ error: string }> => ({
  status,
  body: { error },
  headers,
});

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
