# Perennials

A field guide to about 8,800 useful plants, searched by constraint. Say what your site is — the light, the moisture, the soil — then say what you want from it, and watch the set collapse to what fits. Mobile-first, installs as an offline app, works in a garden with no signal.

Live at [ampactor.dev/perennials](https://ampactor.dev/perennials/).

## What it does

**Constraint-space search.** One bar takes everything: type `wet shade` and it offers both constraints, `zone 6` and it offers the hardiness, `mulberry` and it offers the plant. Each pick becomes a link in a collapse trail — 8,800 → Wet 860 → Full shade 58 → Edible 34 — and every step is removable. The facet rail splits into *the site, what you have* and *the ask, what you want*, and each option carries a live count of what it would still reach. The whole search lives in the address bar, so a list you build is a link you can send.

**Guild view.** The same results stacked by forest-garden layer, canopy down to roots.

**Spots.** Name a place's conditions once — "north bed", "wet corner" — and re-apply them in a tap.

**A page per plant.** Photo, description, the attribute sheet, hardiness, native range, functions, edible parts, flower visitors, bloom, companions, and any caution the source recorded — in the source's own words.

## The data

Three sources, and the app says which is which.

- **[Permapeople](https://permapeople.org)** (CC BY-SA 4.0) — the plants, their descriptions, photos, and most attributes.
- **[GloBI](https://www.globalbioticinteractions.org)** (CC BY 4.0) — flower visitors, from published field observations. Who *actually* turns up at the blooms, rather than who a gardening book supposes might.
- **[USDA PLANTS](https://plants.usda.gov)** (public domain) — bloom colour and bloom period.

It's real data, so it's uneven, and the interface is built to admit that rather than paper over it. Absence is never dressed up as a fact: a plant with no recorded flower visitors says *no observations on record — which is not the same as none*, and every partially-covered facet prints its own coverage. Filtering by hardiness quietly excludes the 2,788 plants nobody has recorded a zone for, so the rail says so. Cautions are shown in the source's exact words, because "Toxic" and "Toxic fruits" are not the same sentence to someone standing over an asparagus bed.

The app fetches its dataset from an API of its own (see [`server/`](server/)) — a Node service on Postgres, hosted on Railway. It re-pulls Permapeople weekly and re-verifies a few plants an hour against GloBI and USDA, which cycles the whole catalogue in about ten weeks. The catalogue comes down compressed, under a megabyte, once; after that the service worker serves it and the app works with no signal. The Permapeople key lives in the API's environment, never in the browser and never in this repo.

Photos are resized by the API (`/img/<id>/<width>.webp`). Permapeople's CDN has no image service, so without this every 56-pixel thumbnail was a full-resolution JPEG. 300px is the ceiling because that is all the source holds.

## Stack

Vite, React, TypeScript. MiniSearch for the name index, built on idle rather than on load. Faceted filtering and the live counts are plain in-memory JS — one pass over the catalogue per interaction. `vite-plugin-pwa` (Workbox) precaches the shell and runtime-caches the data and photos. The look is a hand-rolled CSS design system, a herbarium specimen catalog in light and dark, whose one rule is that saturated colour only ever encodes plant data; the chrome stays ink on paper.

## Run

```sh
npm install
npm run dev      # fetches the dataset from the hosted API
npm run build    # typecheck + production build
npm run preview  # serve the build
```

Point it at a different backend with `VITE_DATA_API` at build time, and add a matching service-worker cache rule in `vite.config.ts`.

## Deploy

The front end ships to GitHub Pages on push to `main`. The API deploys from the **repository root** (`railway up --service api`) — the Railway CLI uploads the whole git repo regardless of the working directory, and `railway.json` pins the build to `server/`. See `server/README.md`.

## Project layout

```
src/data/       model (types), store (fetch, cache, lazy name index)
src/lib/        query (facets, one-pass evaluation, live counts), constraints
                (the atom model + URL codec), suggest (the omnibox grammar),
                spots, bloom, img
src/state/      search (constraints in; results, counts and trail out)
src/components/ Omnibox, Trail, FacetRail, SpotBar, ResultGrid, PlantCard,
                GuildView, Thumb, Layout
src/pages/      Browse, Plant, About
src/styles/     tokens, base, app, browse, detail
server/         the data API: pull, transform, enrich, ingest, resize, serve
```

## Where it's going

- A negation atom, so "nothing invasive" is expressible and not just "find me the invasive ones".
- A native-only filter; the native-range data is already in every record.
