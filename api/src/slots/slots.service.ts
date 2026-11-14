import { Injectable } from '@nestjs/common';
import type { Statement, Transaction } from 'better-sqlite3';
import { ApiError } from '../common/api-error';
import { DatabaseService, SlotRow } from '../database/database.service';
import { SlotDto, SlotWithAvailabilityDto } from './slot.dto';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const SLOT_FIELDS = ['id', 'provider', 'start', 'end'] as const;

type SlotListRow = Omit<SlotRow, 'start_ms'> & { booked: 0 | 1 };

@Injectable()
export class SlotsService {
  private readonly listStmt: Statement<[{ provider: string | null }]>;
  private readonly getStmt: Statement<[string]>;
  private readonly replaceAllTx: Transaction<(slots: SlotDto[]) => void>;

  constructor(database: DatabaseService) {
    const { db } = database;
    this.listStmt = db.prepare(
      `SELECT s.id, s.provider, s.start, s."end",
              EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS booked
         FROM slots s
        WHERE (@provider IS NULL OR s.provider = @provider)
        ORDER BY s.start_ms, s.id`,
    );
    this.getStmt = db.prepare(`SELECT id, provider, start, "end", start_ms FROM slots WHERE id = ?`);

    const insert = db.prepare(`INSERT INTO slots (id, provider, start, "end", start_ms) VALUES (?, ?, ?, ?, ?)`);
    const wipe = [
      db.prepare(`DELETE FROM idempotency_keys`),
      db.prepare(`DELETE FROM bookings`),
      db.prepare(`DELETE FROM slots`),
    ];
    this.replaceAllTx = db.transaction((slots: SlotDto[]) => {
      for (const stmt of wipe) stmt.run();
      for (const s of slots) insert.run(s.id, s.provider, s.start, s.end, Date.parse(s.start));
    });
  }

  list(provider?: string): SlotWithAvailabilityDto[] {
    const rows = this.listStmt.all({ provider: provider ?? null }) as SlotListRow[];
    return rows.map(({ booked, ...slot }) => ({ ...slot, available: booked === 0 }));
  }

  get(id: string): SlotRow | undefined {
    return this.getStmt.get(id) as SlotRow | undefined;
  }

  parseResetBody(body: unknown): SlotDto[] {
    const slots = (body as { slots?: unknown } | null)?.slots;
    if (!Array.isArray(slots)) throw new ApiError(400, 'slots must be an array');

    const seen = new Set<string>();
    return slots.map((raw: unknown, i) => {
      if (typeof raw !== 'object' || raw === null) throw new ApiError(400, `slots[${i}] must be an object`);
      const s = raw as Record<string, unknown>;
      for (const field of SLOT_FIELDS) {
        if (!isNonEmptyString(s[field])) throw new ApiError(400, `slots[${i}].${field} is required`);
      }
      const slot = { id: s.id, provider: s.provider, start: s.start, end: s.end } as SlotDto;
      if (Number.isNaN(Date.parse(slot.start))) throw new ApiError(400, `slots[${i}].start is not a valid date-time`);
      if (Number.isNaN(Date.parse(slot.end))) throw new ApiError(400, `slots[${i}].end is not a valid date-time`);
      if (seen.has(slot.id)) throw new ApiError(400, `duplicate slot id: ${slot.id}`);
      seen.add(slot.id);
      return slot;
    });
  }

  replaceAll(slots: SlotDto[]): void {
    this.replaceAllTx(slots);
  }
}
