// Usage: API_URL=... API_KEY=... node scripts/seed.mjs (wipes all bookings)
const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('Set API_KEY');

const providers = ['Dr Ade', 'Dr Bello', 'Dr Chen'];
const slots = [];
const day = new Date();
day.setUTCHours(0, 0, 0, 0);
for (let added = 0; added < 7; ) {
  day.setUTCDate(day.getUTCDate() + 1);
  if ([0, 6].includes(day.getUTCDay())) continue;
  added++;
  providers.forEach((provider, p) => {
    for (let h = 9; h < 17; h++) {
      if (h === 12 || (h + p) % 3 === 0) continue;
      const start = new Date(day);
      start.setUTCHours(h, 0, 0, 0);
      const end = new Date(start.getTime() + 30 * 60_000);
      slots.push({ id: `${start.toISOString().slice(0, 13)}-${p}`, provider, start: start.toISOString(), end: end.toISOString() });
    }
  });
}

const res = await fetch(`${API_URL}/reset`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
  body: JSON.stringify({ slots }),
});
console.log(res.status, await res.text());
