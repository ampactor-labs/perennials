# Perrenials

A field guide to ~8,800 useful plants, built to be searched by constraint. Pick the light, moisture, layer, function, or hardiness you have, and the set narrows to what fits. Mobile-first, installs as an offline app, no backend.

Live at [ampactor.dev/perrenials](https://ampactor.dev/perrenials/).

## What it does

- **Constraint-space search.** One bar for free text (name or Latin), plus facets for layer, light, water, soil, life cycle, growth, edible parts, function/use, cautions, family, and native range. Constraints stack as removable chips, and every facet option shows a live count of what it would still reach. Type-ahead handles the big facets (107 functions, 348 families, 527 native regions).
- **A page per plant.** Photo, description, the full attribute sheet, hardiness, native range, functions, edibility, and any toxicity or weediness flags, with links out to Wikipedia, Plants For A Future, and Permapeople.
- **Instant across thousands.** Filtering runs entirely in the browser over the whole dataset, so it stays snappy at 8,800 plants. Results are windowed so the page never renders more than it needs.

## The data

Every plant, description, photo, and attribute comes from [Permapeople](https://permapeople.org), an open, community-built plant database, licensed CC BY-SA 4.0. It's real data, so it's also uneven: some entries are rich, others sparse. Nothing here is authored to fill a gap.

The pipeline is build-time, not runtime:

1. `npm run data:pull` fetches the whole Permapeople database via its API (credentials from the environment) and caches the raw dump.
2. `npm run data:transform` normalizes the casing noise, parses ranges, and writes `public/data/plants.json` (one file the app loads once, ~1.3 MB gzipped) plus a facet vocabulary derived from the real data.

The app never calls a plant API at runtime — the key can't live in a browser, and it has to work offline. A scheduled GitHub Actions job (`refresh-data.yml`, weekly) re-runs the pull and transform and commits the result if it changed, which redeploys. That keeps the guide current without any live dependency. Enabling it needs `PERMAPEOPLE_KEY_ID` and `PERMAPEOPLE_KEY_SECRET` set as repo Actions secrets.

## Stack

Vite, React, TypeScript. MiniSearch for the text index; faceted filtering and counts are plain in-memory JS. `vite-plugin-pwa` (Workbox) precaches the app shell and runtime-caches the dataset and images for offline. The look is a hand-rolled CSS design system — a herbarium specimen catalog, light and dark.

## Run

```sh
npm install
npm run dev            # dev server
npm run build          # typecheck + production build
npm run preview        # serve the build
npm run data:pull      # re-fetch Permapeople (needs PERMAPEOPLE_KEY_ID + _SECRET)
npm run data:transform # rebuild public/data from the cached pull
```

Credentials for the pull come from the environment, never a committed file:

```sh
PERMAPEOPLE_KEY_ID=… PERMAPEOPLE_KEY_SECRET=… npm run data:pull
```

## Project layout

```
src/data/       model (types), store (fetch + cache + in-memory index)
src/lib/        query (facet access, filtering, live counts), settings
src/state/      search (constraints in, results and counts out)
src/components/ ConstraintBar, FacetRail, ResultGrid, PlantCard, Layout
src/pages/      Browse, Plant, About
src/styles/     tokens, base, app, detail, browse
scripts/data/   pull-permapeople (full DB pull), transform (-> public/data)
public/data/    the generated snapshot the app fetches
```

## Where it's going

- A native-only filter and companion/guild links (Permapeople exposes `/companions` per plant).
- Cross-check Permapeople's warnings against USDA invasive listings for a firmer honesty layer.
- Shareable constraint URLs, so a search can be sent as a link.
