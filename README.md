# Perennials

A field guide to about 8,800 useful plants, searched by constraint. Pick the light, moisture, layer, function, or hardiness you have, and the set narrows to what fits. Mobile-first, installs as an offline app.

Live at [ampactor.dev/perennials](https://ampactor.dev/perennials/).

## What it does

- **Constraint-space search.** One bar for free text (name or Latin), plus facets for layer, light, water, soil, life cycle, growth, edible parts, function/use, cautions, family, and native range. Constraints stack as removable chips, and every facet option shows a live count of what it would still reach. Type-ahead handles the big facets (107 functions, 348 families, 527 native regions).
- **A page per plant.** Photo, description, the full attribute sheet, hardiness, native range, functions, edibility, and any caution flags the data carries, with links out to Wikipedia, Plants For A Future, and Permapeople.
- **Instant across thousands.** Filtering runs entirely in the browser over the whole dataset, so it stays snappy at 8,800 plants. Results are windowed so the page never renders more than it needs.

## The data

Every plant, description, photo, and attribute comes from [Permapeople](https://permapeople.org), an open, community-built plant database, licensed CC BY-SA 4.0. It's real data, so it's also uneven: some entries are rich, others sparse. Nothing here is authored to fill a gap.

The app fetches its dataset from a small API of its own (see [`server/`](server/)), not from a file in this repo. The API is a Node service backed by Postgres, hosted on Railway. It pulls the whole Permapeople database, normalizes the casing noise and parses ranges the way the app expects, and serves three payloads: `plants.json`, `facets.json`, and `meta.json`. The browser fetches those once and does all search and filtering in memory. The service worker caches the responses, so the installed app still works offline.

The API keeps itself current. It refreshes from Permapeople on a weekly schedule, so the data the app sees tracks the source without anyone committing a snapshot. The Permapeople key lives in the API's environment on Railway, never in the browser and never in this repo.

## Stack

Vite, React, TypeScript on the front end. MiniSearch for the text index; faceted filtering and counts are plain in-memory JS. `vite-plugin-pwa` (Workbox) precaches the app shell and runtime-caches the dataset and images for offline. The look is a hand-rolled CSS design system, a herbarium specimen catalog in light and dark.

The back end lives in [`server/`](server/): Node and `pg`, with Postgres and the service hosted on Railway. `server/README.md` covers it.

## Run

```sh
npm install
npm run dev      # dev server (fetches the dataset from the hosted API)
npm run build    # typecheck + production build
npm run preview  # serve the build
```

The app talks to the hosted API by default. To point it at a different backend, set `VITE_DATA_API` (the base URL that serves `/plants.json`, `/facets.json`, and `/meta.json`) at build time, and add a matching service-worker cache rule in `vite.config.ts`.

## Project layout

```
src/data/       model (types), store (fetch + cache + in-memory index)
src/lib/        query (facet access, filtering, live counts), settings
src/state/      search (constraints in, results and counts out)
src/components/ ConstraintBar, FacetRail, ResultGrid, PlantCard, Layout
src/pages/      Browse, Plant, About
src/styles/     tokens, base, app, detail, browse
server/         the data API (Node + Postgres): pull, transform, ingest, serve
```

## Where it's going

- A native-only filter (the native-range data is already in each record).
- Cross-check Permapeople's cautions against USDA regulated-plant listings for a firmer honesty layer.
