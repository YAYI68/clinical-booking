import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config';

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** Level 5: sliding-window limit per key. In-memory, so single-instance only. */
@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    ({ max: this.max, windowMs: this.windowMs } = config.rateLimit);
    this.sweeper = setInterval(() => this.sweep(), this.windowMs);
    this.sweeper.unref();
  }

  hit(key: string, now = Date.now()): RateLimitDecision {
    const windowStart = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] - windowStart) / 1000)) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true };
  }

  clear(): void {
    this.hits.clear();
  }

  private sweep(now = Date.now()): void {
    for (const [key, times] of this.hits) {
      if (times[times.length - 1] <= now - this.windowMs) this.hits.delete(key);
    }
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
  }
}
