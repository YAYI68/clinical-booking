// Writes dummy slots + bookings straight into SQLite (wipes existing data).
// Usage: npm run build && npm run seed:db
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const { DatabaseService } = require('../dist/database/database.service.js');

const dbPath = process.env.DB_PATH ?? './data/clinic.db';
const { db } = new DatabaseService({ dbPath });

const providers = ['Dr Ade', 'Dr Bello', 'Dr Chen'];
const DAY = 24 * 60 * 60 * 1000;
const today = new Date();
today.setUTCHours(0, 0, 0, 0);

const weekdays = (from, step, n) => {
  const days = [];
  for (let d = from; days.length < n; d += step) {
    const day = new Date(today.getTime() + d * DAY);
    if (![0, 6].includes(day.getUTCDay())) days.push(day);
  }
  return days;
};

// Slots: 5 past + 10 upcoming weekdays, 09:00–16:30 every 30 min, lunch off.
const slots = [];
for (const day of [...weekdays(-1, -1, 5).reverse(), ...weekdays(1, 1, 10)]) {
  for (const provider of providers) {
    for (let m = 9 * 60; m < 17 * 60; m += 30) {
      if (m >= 12 * 60 && m < 13 * 60) continue;
      const start = new Date(day.getTime() + m * 60_000);
      const end = new Date(start.getTime() + 30 * 60_000);
      const id = `${provider.split(' ')[1].toLowerCase()}-${start.toISOString().slice(0, 16).replace(/[-:]/g, '')}`;
      slots.push({ id, provider, start: start.toISOString(), end: end.toISOString(), past: start <= new Date() });
    }
  }
}

const patients = [
  { name: 'Ada Obi', email: 'ada@example.com', count: 23 }, // > 2 pages at the default limit of 10
  { name: 'Tunde Bakare', email: 'tunde@example.com', count: 6 },
  { name: 'Grace Hopper', email: 'grace@example.com', count: 4 },
  { name: 'Chen Wei', email: 'chen.wei@example.com', count: 3 },
  { name: 'Fatima Yusuf', email: 'fatima@example.com', count: 2 },
  { name: 'Liam Murphy', email: 'liam@example.com', count: 1 },
];

// Deterministic pseudo-random so every run gives the same data.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const bookings = [];
const taken = new Set();
const free = () => {
  for (;;) {
    const s = slots[Math.floor(rand() * slots.length)];
    if (!taken.has(s.id)) return s;
  }
};
let createdAt = Date.now() - 20 * DAY;
for (const p of patients) {
  for (let i = 0; i < p.count; i++) {
    const slot = free();
    const cancelled = rand() < 0.25;
    if (!cancelled) taken.add(slot.id); // cancelled slots stay bookable
    createdAt += Math.floor(rand() * 6 * 60 * 60 * 1000);
    bookings.push({
      id: `b_${randomUUID()}`,
      slot_id: slot.id,
      name: p.name,
      email: p.email,
      status: cancelled ? 'cancelled' : 'confirmed',
      created_at: new Date(Math.min(createdAt, Date.now())).toISOString(),
    });
  }
}
bookings.sort((a, b) => a.created_at.localeCompare(b.created_at)); // seq order = oldest first

const insertSlot = db.prepare(`INSERT INTO slots (id, provider, start, "end", start_ms) VALUES (?, ?, ?, ?, ?)`);
const insertBooking = db.prepare(
  `INSERT INTO bookings (id, slot_id, name, email, status, created_at) VALUES (@id, @slot_id, @name, @email, @status, @created_at)`,
);
db.transaction(() => {
  db.exec(`DELETE FROM idempotency_keys; DELETE FROM bookings; DELETE FROM slots;`);
  for (const s of slots) insertSlot.run(s.id, s.provider, s.start, s.end, Date.parse(s.start));
  for (const b of bookings) insertBooking.run(b);
})();

const count = (sql) => db.prepare(sql).get().n;
console.log(`Seeded ${dbPath}`);
console.log(`  slots:    ${slots.length} (${slots.filter((s) => s.past).length} in the past)`);
console.log(`  bookings: ${bookings.length} (${count(`SELECT COUNT(*) n FROM bookings WHERE status='cancelled'`)} cancelled)`);
console.log(`  free upcoming slots: ${count(`SELECT COUNT(*) n FROM slots s WHERE start_ms > ${Date.now()} AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status='confirmed')`)}`);
console.log('\nPatients:');
for (const p of patients) console.log(`  ${p.email.padEnd(22)} ${p.count} bookings`);
const sample = bookings.find((b) => b.status === 'confirmed');
console.log(`\nSample booking id: ${sample.id}`);
db.close();
