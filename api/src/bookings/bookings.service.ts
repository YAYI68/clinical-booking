import { Injectable } from '@nestjs/common';
import type { Statement } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ApiResult, fail, ok } from '../common/api-error';
import { BookingRow, DatabaseService } from '../database/database.service';
import { SlotsService } from '../slots/slots.service';
import { BookingDto, BookingPageDto } from './booking.dto';
import { IdempotencyStore } from './idempotency.store';
import {
  DEFAULT_PAGE_SIZE,
  EMAIL_RE,
  MAX_EMAIL,
  MAX_IDEMPOTENCY_KEY,
  MAX_NAME,
  MAX_PAGE_SIZE,
  REQUIRED_FIELDS,
} from './bookings.constants';
import { decodeCursor, encodeCursor, toDto } from './bookings.utils';
import { RateLimiterService } from './rate-limiter.service';

@Injectable()
export class BookingsService {
  private readonly insertStmt: Statement<[BookingDto]>;
  private readonly getStmt: Statement<[string]>;
  private readonly cancelStmt: Statement<[string]>;
  private readonly pageStmt: Statement<[string, number, number]>;

  constructor(
    database: DatabaseService,
    private readonly slots: SlotsService,
    private readonly rateLimiter: RateLimiterService,
    private readonly idempotency: IdempotencyStore,
  ) {
    const { db } = database;
    this.insertStmt = db.prepare(
      `INSERT INTO bookings (id, slot_id, name, email, status, created_at)
       VALUES (@id, @slot_id, @name, @email, @status, @created_at)`,
    );
    this.getStmt = db.prepare(`SELECT * FROM bookings WHERE id = ?`);
    this.cancelStmt = db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'confirmed'`);
    this.pageStmt = db.prepare(`SELECT * FROM bookings WHERE email = ? AND seq > ? ORDER BY seq LIMIT ?`);
  }

  /** Idempotency replay → rate limit → validate → book. */
  create(body: unknown, idempotencyKey: string | undefined): ApiResult {
    if (idempotencyKey === undefined) return this.rateLimited(body) ?? this.book(body);

    if (idempotencyKey.trim() === '' || idempotencyKey.length > MAX_IDEMPOTENCY_KEY) {
      return fail(400, `Idempotency-Key must be 1-${MAX_IDEMPOTENCY_KEY} characters`);
    }
    const fingerprint = this.idempotency.fingerprint(body);
    const previous = this.idempotency.lookup(idempotencyKey, fingerprint);
    if (previous.kind === 'replay') return previous.response;
    if (previous.kind === 'mismatch') {
      return fail(422, 'Idempotency-Key has already been used with a different request body');
    }

    // 429s are temporary, so not saved.
    const limited = this.rateLimited(body);
    if (limited) return limited;

    const result = this.book(body);
    this.idempotency.save(idempotencyKey, fingerprint, result);
    return result;
  }

  private rateLimited(body: unknown): ApiResult | null {
    const email = (body as { email?: unknown } | null)?.email;
    if (typeof email !== 'string' || email.trim() === '') return null;

    const decision = this.rateLimiter.hit(`email:${email.trim().toLowerCase()}`);
    if (decision.allowed) return null;
    return fail(429, 'too many booking attempts for this email, try again later', {
      'Retry-After': String(decision.retryAfterSeconds),
    });
  }

  private book(body: unknown): ApiResult {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return fail(400, 'request body must be a JSON object');
    }
    const input = body as Record<string, unknown>;

    for (const field of REQUIRED_FIELDS) {
      const value = input[field];
      if (value === undefined || value === null) return fail(400, `${field} is required`);
      if (typeof value !== 'string') return fail(400, `${field} must be a string`);
      if (value.trim() === '') return fail(400, `${field} must not be empty`);
    }
    const slotId = (input.slot_id as string).trim();
    const name = (input.name as string).trim();
    const email = (input.email as string).trim().toLowerCase();

    if (name.length > MAX_NAME) return fail(400, `name must be at most ${MAX_NAME} characters`);
    if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return fail(400, 'email is not valid');

    const slot = this.slots.get(slotId);
    if (!slot) return fail(404, 'slot not found');
    if (slot.start_ms <= Date.now()) return fail(400, 'slot has already started');

    const booking: BookingDto = {
      id: `b_${randomUUID()}`,
      slot_id: slot.id,
      name,
      email,
      status: 'confirmed',
      created_at: new Date().toISOString(),
    };
    try {
      this.insertStmt.run(booking);
    } catch (err) {
      if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') return fail(409, 'slot is already booked');
      throw err;
    }
    return ok(booking, 201);
  }

  get(id: string): ApiResult {
    const row = this.getStmt.get(id) as BookingRow | undefined;
    return row ? ok(toDto(row)) : fail(404, 'booking not found');
  }

  cancel(id: string): ApiResult {
    const row = this.getStmt.get(id) as BookingRow | undefined;
    if (!row) return fail(404, 'booking not found');
    if (this.cancelStmt.run(id).changes === 0) return fail(409, 'booking is already cancelled');
    return ok(toDto({ ...row, status: 'cancelled' }));
  }

  listByEmail(emailParam: unknown, limitParam: unknown, cursorParam: unknown): ApiResult<BookingPageDto | { error: string }> {
    if (typeof emailParam !== 'string' || emailParam.trim() === '') return fail(400, 'email is required');
    const email = emailParam.trim().toLowerCase();

    let limit = DEFAULT_PAGE_SIZE;
    if (limitParam !== undefined) {
      limit = typeof limitParam === 'string' && /^\d+$/.test(limitParam) ? Number(limitParam) : NaN;
      if (!(limit >= 1 && limit <= MAX_PAGE_SIZE)) return fail(400, `limit must be an integer from 1 to ${MAX_PAGE_SIZE}`);
    }

    let after = 0;
    if (cursorParam !== undefined) {
      const decoded = typeof cursorParam === 'string' ? decodeCursor(cursorParam) : null;
      if (decoded === null) return fail(400, 'cursor is not valid');
      after = decoded;
    }

    // One extra row tells us if there's a next page.
    const rows = this.pageStmt.all(email, after, limit + 1) as BookingRow[];
    const page = rows.slice(0, limit);
    const next_cursor = rows.length > limit ? encodeCursor(page[page.length - 1].seq) : null;
    return ok({ bookings: page.map(toDto), next_cursor });
  }
}
