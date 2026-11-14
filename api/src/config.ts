export interface AppConfig {
  apiKey: string;
  port: number;
  dbPath: string;
  corsOrigins: true | string[];
  rateLimit: { max: number; windowMs: number };
  idempotencyTtlMs: number;
  logRequests: boolean;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

function positiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer, got "${raw}"`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const apiKey = env.API_KEY?.trim();
  if (!apiKey) throw new Error('API_KEY environment variable is required');

  const origins = (env.CORS_ORIGIN ?? '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    apiKey,
    port: positiveInt(env, 'PORT', 3000),
    dbPath: env.DB_PATH ?? './data/clinic.db',
    corsOrigins: origins.length === 0 || origins.includes('*') ? true : origins,
    rateLimit: {
      max: positiveInt(env, 'RATE_LIMIT_MAX', 5),
      windowMs: positiveInt(env, 'RATE_LIMIT_WINDOW_MS', 60_000),
    },
    idempotencyTtlMs: positiveInt(env, 'IDEMPOTENCY_TTL_MS', 24 * 60 * 60 * 1000),
    logRequests: env.NODE_ENV !== 'test',
  };
}
