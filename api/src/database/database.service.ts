import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { APP_CONFIG, AppConfig } from '../config';

export interface SlotRow {
  id: string;
  provider: string;
  start: string;
  end: string;
  start_ms: number;
}

export interface BookingRow {
  seq: number;
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: 'confirmed' | 'cancelled';
  created_at: string;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: Database.Database;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    if (config.dbPath !== ':memory:') mkdirSync(dirname(config.dbPath), { recursive: true });
    this.db = new Database(config.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS slots (
        id        TEXT PRIMARY KEY,
        provider  TEXT NOT NULL,
        start     TEXT NOT NULL,
        "end"     TEXT NOT NULL,
        start_ms  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS slots_by_start ON slots (start_ms, id);
      CREATE INDEX IF NOT EXISTS slots_by_provider ON slots (provider, start_ms, id);

      CREATE TABLE IF NOT EXISTS bookings (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        id         TEXT NOT NULL UNIQUE,
        slot_id    TEXT NOT NULL REFERENCES slots (id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        email      TEXT NOT NULL,
        status     TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
        created_at TEXT NOT NULL
      );
      -- Level 3: one confirmed booking per slot.
      CREATE UNIQUE INDEX IF NOT EXISTS one_confirmed_booking_per_slot
        ON bookings (slot_id) WHERE status = 'confirmed';
      CREATE INDEX IF NOT EXISTS bookings_by_email ON bookings (email, seq);

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key         TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        status      INTEGER NOT NULL,
        body        TEXT NOT NULL,
        created_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idempotency_by_created ON idempotency_keys (created_at);
    `);
  }

  onModuleDestroy() {
    this.db.close();
  }
}
