# perennials data service

The API the app fetches its dataset from, replacing the static snapshot the repo used
to commit. Node + Postgres, deployed on Railway.

## What it serves

- `GET /data/plants.json` · `GET /data/facets.json` · `GET /data/meta.json`. The same
  three payloads the static site shipped, rebuilt from Postgres, compressed (brotli
  takes the catalogue from 8.9 MB to under 1 MB), and ETagged on their own content.
- `GET /img/<plant id>/<width>.webp`. A plant photo resized to one of 64, 128, 192,
  300, 400, 600 or 800px. Permapeople's CDN has no image service, so this is where a
  56-pixel thumbnail stops being a full-resolution JPEG. 800 is the ceiling because
  that is the resolution the source actually holds.
- `GET /health`. Plant count, data age, how far each enrichment sweep has got, and the
  outcome of the last source pull. A refresh takes about eleven minutes, which is
  longer than the edge will hold a connection, so `lastRefresh` is the only way to
  tell a failed pull from a working one.
- `POST /admin/refresh` · `/admin/enrich` · `/admin/recheck`. All require
  `Authorization: Bearer $ADMIN_TOKEN`.

## How it fills the DB

`src/ingest.mjs` has two paths:

- **source** — pull the whole Permapeople DB and transform it (needs `PERMAPEOPLE_KEY_ID`
  and `PERMAPEOPLE_KEY_SECRET`). `src/transform.mjs` is a verbatim port of the old
  build-time transform (now only in git history), so records match the old pipeline.
- **seed** — with no key, fetch the already-built dataset from `SEED_URL`
  (the live static file) so the API serves identical data with no empty window.

On top of Permapeople it enriches from two more sources: GloBI for flower visitors
(CC BY 4.0) and USDA PLANTS for bloom colour and period (public domain). Sweeps are
resumable: a failed lookup leaves the field NULL and is retried next time, while a
plant that was checked and genuinely has nothing keeps its empty result. That
distinction is the difference between "nobody looked" and "there is nothing there",
and the app is careful to say which.

The service checks staleness on boot and hourly (not on a daily timer; a daily
interval only fires after 24 hours of unbroken uptime, and every deploy resets it).
A weekly source refresh preserves the enrichment already paid for, and every hour it
re-verifies the five stalest plants, which cycles the whole catalogue in about ten
weeks.

## Deploying

Deploy from the **repository root**, not from this directory:

```sh
railway up --service api
```

The Railway CLI uploads the whole git repository regardless of the working directory.
Run it from `server/` and it still uploads the root, Nixpacks sees the Vite app at the
top level, and the API is quietly replaced by a static site. `railway.json` at the root
exists to stop that: it installs this directory's dependencies and starts
`server/src/api.mjs`.

## Environment

| var | purpose |
|-----|---------|
| `DATABASE_URL` | Postgres (Railway reference `${{Postgres.DATABASE_URL}}`) |
| `SEED_URL` | fallback dataset to seed from (defaults to the live static file) |
| `PERMAPEOPLE_KEY_ID` / `PERMAPEOPLE_KEY_SECRET` | enable source refresh |
| `ADMIN_TOKEN` | guards the `POST /admin/*` endpoints |
| `PORT` | set by Railway |

## Run locally

```sh
cd server && npm install
DATABASE_URL=postgres://... npm start          # seeds from SEED_URL, serves on :3000
DATABASE_URL=postgres://... npm run ingest     # one-off ingest
```
