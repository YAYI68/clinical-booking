# Clinic Booking

A small app for booking clinic appointments. Patients pick a free slot, book it, get a confirmation, and can look up or cancel their bookings later.

- **API:** NestJS + SQLite, in [`api/`](api/)
- **Web app:** React + Vite, in [`frontend/`](frontend/)

## Links

| | Local | Production |
| --- | --- | --- |
| Web app | http://localhost:5173 | _add after deploy_ |
| API docs (Swagger) | http://localhost:3000/docs | https://clinical-booking-meid.onrender.com/docs |

In Swagger, click **Authorize** and paste your `API_KEY` to try requests.

## Running it locally

You'll need Node 22.9 or newer.

**1. Set the API key.** Both apps read it from a `.env` file. Copy the examples and use the same key in each:

```bash
cp api/.env.example api/.env
cp frontend/.env.example frontend/.env
```

**2. Start the API** (first terminal):

```bash
cd api
npm install
npm run build
npm run seed:db   # optional: loads test slots and bookings
npm run dev
```

**3. Start the web app** (second terminal):

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

If port 3000 is already in use, run `lsof -nP -iTCP:3000 -sTCP:LISTEN` to see which process has it and stop that process.

## Test data

`npm run seed:db` resets the local database with about 600 slots and 39 bookings. Try searching `ada@example.com` under **My bookings**. It has 23 bookings, enough to page through.

Run it again whenever you want a clean slate.

## Deploying

- **API:** deploy to Render using [`render.yaml`](render.yaml). Set `API_KEY`.
- **Web app:** deploy to Vercel with the root directory set to `frontend`. Set `API_URL` (your Render URL) and `API_KEY`.

Once the API is live, load slots with `API_URL=<render-url> npm run seed` from `api/`.

## Recommended improvements for production

The current setup suits a single server. Before running it at real scale, I'd make these changes:

**Move to a scalable database.** SQLite is a file on one machine, so only one server can use it.
- **PostgreSQL** (recommended) or **MySQL** let several API servers share the same data.
  - Postgres supports the same partial unique index that stops double-booking.
  - MySQL needs a small workaround, such as a nullable column holding the slot id only while the booking is confirmed.
- **MongoDB** can also work. Enforce one confirmed booking per slot with a unique index that uses `partialFilterExpression`.
- Whichever you choose, use a managed service with backups and connection pooling, and manage schema changes through migrations (for example Prisma or TypeORM).

**Add Redis.** The rate limiter keeps its counts in memory, so with several servers each would count separately and someone could get around the 5-per-minute limit.
- **Rate limiting:** move the counts to Redis so every server shares them. A sorted set per email works well for a sliding window.
- **Idempotency keys:** move these to Redis too. It can expire old keys on its own, and a "set only if new" write (`SET NX`) stops two servers from handling the same retry twice.
- **Slot lists:** you can also cache them briefly to reduce database load.

**Write automated tests.**
- **Unit tests** for validation, cursor encoding, the rate limiter and the idempotency logic.
- **End-to-end tests** for every endpoint and error code in the spec, run against a real database (for example with Testcontainers).
- **Concurrency tests:** many simultaneous bookings for one slot must give exactly one success. Also check that retries with the same idempotency key never create duplicates.
- **Load tests** (for example k6) to find limits before real traffic does.
- Run all of these in CI on every pull request.

**Lock down `/reset`.** It deletes every booking, and today anyone with the API key can call it. In production, switch it off with an environment flag or put it behind a separate admin key.

## Good to know

- Every API request needs an `X-API-Key` header. The web app never exposes the key to the browser: a small proxy adds it on the server side.
- The same slot can never be booked twice, even by two simultaneous requests. The database enforces this.
- Booking retries are safe: send an `Idempotency-Key` header and a retried request won't create a duplicate.
- Each email can attempt at most 5 bookings per minute.
