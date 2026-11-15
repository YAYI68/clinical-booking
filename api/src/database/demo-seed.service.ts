import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG, AppConfig } from '../config';
import { DatabaseService } from './database.service';

const DAY = 24 * 60 * 60 * 1000;
const PROVIDERS = ['Dr Ade', 'Dr Bello', 'Dr Chen'];
const PATIENTS: [name: string, email: string, count: number][] = [
  ['Ada Obi', 'ada@example.com', 12],
  ['Tunde Bakare', 'tunde@example.com', 5],
  ['Grace Hopper', 'grace@example.com', 3],
  ['Chen Wei', 'chen.wei@example.com', 2],
];

// Loads demo data when the database is empty, e.g. after a free Render instance restarts.
@Injectable()
export class DemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('DemoSeed');

  constructor(
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.seedOnStart) return;
    const { db } = this.database;
    if ((db.prepare(`SELECT COUNT(*) n FROM slots`).get() as { n: number }).n > 0) return;

    const slots = buildSlots();
    const insertSlot = db.prepare(`INSERT INTO slots (id, provider, start, "end", start_ms) VALUES (?, ?, ?, ?, ?)`);
    const insertBooking = db.prepare(
      `INSERT INTO bookings (id, slot_id, name, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    );

    let bookings = 0;
    db.transaction(() => {
      for (const s of slots) insertSlot.run(s.id, s.provider, s.start, s.end, Date.parse(s.start));
      let i = 0;
      const createdAt = Date.now() - DAY;
      for (const [name, email, count] of PATIENTS) {
        for (let n = 0; n < count; n++, i++) {
          const slot = slots[(i * 7) % slots.length];
          const status = n % 4 === 3 ? 'cancelled' : 'confirmed';
          insertBooking.run(`b_${randomUUID()}`, slot.id, name, email, status, new Date(createdAt + i * 60_000).toISOString());
          bookings++;
        }
      }
    })();
    this.logger.log(`Empty database: seeded ${slots.length} slots and ${bookings} bookings`);
  }
}

// 10 upcoming weekdays, 09:00–16:30 every 30 min, lunch off.
function buildSlots() {
  const slots: { id: string; provider: string; start: string; end: string }[] = [];
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  for (let added = 0; added < 10; ) {
    day.setTime(day.getTime() + DAY);
    if ([0, 6].includes(day.getUTCDay())) continue;
    added++;
    for (const provider of PROVIDERS) {
      for (let m = 9 * 60; m < 17 * 60; m += 30) {
        if (m >= 12 * 60 && m < 13 * 60) continue;
        const start = new Date(day.getTime() + m * 60_000);
        const end = new Date(start.getTime() + 30 * 60_000);
        const id = `${provider.split(' ')[1].toLowerCase()}-${start.toISOString().slice(0, 16).replace(/[-:]/g, '')}`;
        slots.push({ id, provider, start: start.toISOString(), end: end.toISOString() });
      }
    }
  }
  return slots;
}
