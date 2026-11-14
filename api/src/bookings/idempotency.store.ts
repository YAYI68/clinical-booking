import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Statement } from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { ApiResult } from '../common/api-error';
import { APP_CONFIG, AppConfig } from '../config';
import { DatabaseService } from '../database/database.service';

interface StoredResponse {
  fingerprint: string;
  status: number;
  body: string;
}

/** Key order doesn't affect the fingerprint. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export type IdempotencyLookup =
  | { kind: 'new' }
  | { kind: 'replay'; response: ApiResult }
  | { kind: 'mismatch' };

/** Level 4: stores one response per Idempotency-Key; expired rows are ignored and swept. */
@Injectable()
export class IdempotencyStore implements OnModuleDestroy {
  private readonly ttlMs: number;
  private readonly findStmt: Statement<[string, number]>;
  private readonly saveStmt: Statement<[string, string, number, string, number]>;
  private readonly purgeStmt: Statement<[number]>;
  private readonly sweeper: NodeJS.Timeout;

  constructor(database: DatabaseService, @Inject(APP_CONFIG) config: AppConfig) {
    this.ttlMs = config.idempotencyTtlMs;
    const { db } = database;
    this.findStmt = db.prepare(`SELECT fingerprint, status, body FROM idempotency_keys WHERE key = ? AND created_at >= ?`);
    this.saveStmt = db.prepare(
      `INSERT OR REPLACE INTO idempotency_keys (key, fingerprint, status, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    this.purgeStmt = db.prepare(`DELETE FROM idempotency_keys WHERE created_at < ?`);
    this.sweeper = setInterval(() => this.purgeExpired(), Math.min(this.ttlMs, 60 * 60 * 1000));
    this.sweeper.unref();
  }

  fingerprint(body: unknown): string {
    return createHash('sha256').update(canonicalJson(body)).digest('hex');
  }

  lookup(key: string, fingerprint: string, now = Date.now()): IdempotencyLookup {
    const saved = this.findStmt.get(key, now - this.ttlMs) as StoredResponse | undefined;
    if (!saved) return { kind: 'new' };
    if (saved.fingerprint !== fingerprint) return { kind: 'mismatch' };
    return { kind: 'replay', response: { status: saved.status, body: JSON.parse(saved.body) } };
  }

  save(key: string, fingerprint: string, response: ApiResult, now = Date.now()): void {
    // REPLACE overwrites an expired row not yet swept.
    this.saveStmt.run(key, fingerprint, response.status, JSON.stringify(response.body), now);
  }

  purgeExpired(now = Date.now()): void {
    this.purgeStmt.run(now - this.ttlMs);
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
  }
}
