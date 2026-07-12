# perrenials data service

The API the app fetches its dataset from, replacing the committed `public/data/*.json`
snapshot. Node + Postgres, deployed on Railway.

## What it serves

- `GET /data/plants.json` · `GET /data/facets.json` · `GET /data/meta.json` — the same
  three payloads the static site shipped, rebuilt from Postgres, ETagged, CORS-open.
- `GET /health` — `{ ok, plants, source }`.
- `POST /admin/refresh` — force a re-ingest (requires `Authorization: Bearer $ADMIN_TOKEN`).

## How it fills the DB

`src/ingest.mjs` has two paths:

- **source** — pull the whole Permapeople DB and transform it (needs `PERMAPEOPLE_KEY_ID`
  and `PERMAPEOPLE_KEY_SECRET`). `src/transform.mjs` is a verbatim port of
  `scripts/data/transform.mjs`, so records match the old pipeline.
- **seed** — with no key, fetch the already-built dataset from `SEED_URL`
  (the live static file) so the API serves identical data with no empty window.

The always-on `api` service seeds on an empty boot and, once source credentials are set,
refreshes in-process when the data is a week old. A source refresh preserves companion
links already stored, so the expensive per-plant companions sweep doesn't re-run.

## Environment

| var | purpose |
|-----|---------|
| `DATABASE_URL` | Postgres (Railway reference `${{Postgres.DATABASE_URL}}`) |
| `SEED_URL` | fallback dataset to seed from (defaults to the live static file) |
| `PERMAPEOPLE_KEY_ID` / `PERMAPEOPLE_KEY_SECRET` | enable source refresh (set by you) |
| `ADMIN_TOKEN` | optional; guards `POST /admin/refresh` |
| `PORT` | set by Railway |

## Run locally

```sh
cd server && npm install
DATABASE_URL=postgres://... npm start          # seeds from SEED_URL, serves on :3000
DATABASE_URL=postgres://... npm run ingest      # one-off ingest
```
