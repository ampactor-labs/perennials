# Perennials

[![Deploy](https://img.shields.io/github/actions/workflow/status/ampactor-labs/perennials/deploy.yml?branch=main&label=deploy)](https://github.com/ampactor-labs/perennials/blob/main/.github/workflows/deploy.yml)

A field guide to about 8,800 useful plants that you search by site conditions such as light, water and soil. Each condition you add shows how many plants remain, the search lives in the URL, and gaps in the open data (Permapeople, GloBI, USDA PLANTS) show as gaps. A yard sketch places any plant on your own ground and computes the sun from your latitude. It is a React and TypeScript PWA (a web app the browser installs and runs offline) over a Node and Postgres API on Railway.

**Status: shipping.** The plant data is community-sourced and is not verified here, and the repository has no license file yet.

Live: https://ampactor.dev/perennials/

## Quick start

```sh
npm install
npm run dev      # http://localhost:5173/perennials/
```

The dev server fetches the catalogue from the hosted API, so it needs a connection. You should see the browse page listing the whole catalogue (8,858 plants when I checked on 2026-09-27) with one search box above it. Type `wet shade` and it offers both conditions; type `zone 6` and it offers the hardiness zone (a USDA band of average winter minimum temperature; zone 6 is about -23 to -18 °C); type `mulberry` and it offers the plant. Each pick becomes a step in a trail with its count, and any step can be removed. Offline use needs the production build below: its service worker precaches the app shell, and the app writes the three payloads into the worker's cache on first load, so a phone that has opened the built app once keeps working with no signal.

```sh
npm run build    # typecheck and production build; copies index.html to 404.html
npm run preview  # http://localhost:4173/perennials/
```

To use another backend, set `VITE_DATA_API` at build time and add a matching service-worker cache rule in `vite.config.ts`.

## How it works

The front end is Vite, React and TypeScript. The catalogue comes from an API of its own (`server/`, Node and Postgres on Railway). On load `src/data/store.tsx` fetches three JSON payloads (plants, facets, meta), writes them into the service worker's cache itself (the fetch fires before Workbox claims the page, so without this a first visit would not cache the guide) and holds them in memory. A MiniSearch name index is built when the browser next goes idle, because an 8,800-document pass costs about half a second of frozen main thread on a phone.

Faceted search (each attribute is a facet, each value a pick, and each pick shows how many plants it would leave) runs in plain JavaScript. `evaluate()` in `src/lib/query.ts` produces the results, the per-option counts and the trail in one pass over the catalogue: for each plant it collects the constraints it fails, an empty set makes it a result, a single failure makes it count towards that facet's options, and the trail counts are suffix sums of a histogram of earliest failures. The constraints are an ordered list of atoms that round-trips through the URL (`src/lib/constraints.ts`), so a list you build is a link you can send.

Two decisions shape the rest. Absence is never presented as a fact: a field the sources did not fill reads "not in our sources", the facet rail beside the results prints coverage for the set on screen, and a hardiness filter excludes a plant with no record exactly as it excludes one that would die there, which the rail says out loud. And your own values live beside the record: `Plant` (`src/data/model.ts`) is exactly what the API sent, your notes, bloom marks, photos and filled-in blanks ride in `Dataset.mine`, and `ACCESS` in `src/lib/query.ts` is the one place the guide asks what a plant is, so a value you fill in filters, counts and sorts like the record's, renders in its own sepia, and is never attributed to a source.

The yard (`src/pages/YardPage.tsx`) is a sketch with the record drawn on top, in three projections: plan, elevation, and a three.js model you can orbit or walk into. Size is a claim, so a plant with no recorded height draws no figure in the vertical views and stays a mark on the line, and figures are the archetype of the plant's guild layer, its forest-garden storey from canopy down to roots (`src/lib/elevation.ts`). The ground is interpolated from spot heights you tap in (`src/lib/ground.ts`): exact at your marks, level where you set none. Give it your latitude and the sheet's span in metres and `src/lib/sun.ts` computes each bed's hours of direct light and the hour's shadow; every answer is one of the catalogue's own light words, so one tap opens the guide filtered to what would live there. The model's three.js chunk loads only when a Model view mounts (142.83 kB gzipped in this build, against 108.26 kB for the rest of the app), and the service worker precaches it, so the model opens offline.

The full tour of the screens is in [docs/features.md](docs/features.md).

### Your data

Everything you write lives in this origin's `localStorage` (eight `perennials.*.v1` keys plus `perennials.theme`) and one IndexedDB database, `perennials-photos`, because a phone photo would exhaust the roughly 5 MB that localStorage allows. There is no account and no server-side copy, so the backup is the sync: the Field notes page writes a `.json` that restores every store, photos included, and a `.txt` that outlives the app. A restore merges by default with the newest entry winning, because the realistic restore is your second phone. Updates never touch your data: the service worker (`registerType: "autoUpdate"`) swaps its own precache and reloads once, and it only ever clears Cache Storage. The remaining loss vector is the browser evicting storage (iOS clears a tab's script storage after about seven days without a visit), so the app asks for persistent storage on your first write and offers to install to the home screen.

## Data

The dataset is not in this repository. The API in `server/` pulls it, normalises it (`server/src/transform.mjs` reads 22 named fields from each Permapeople record), enriches it and serves it as three JSON files; `plants.json` was 11.5 MB raw and 1.34 MB brotli-compressed when I fetched it on 2026-09-27. The sources:

- [Permapeople](https://permapeople.org) (CC BY-SA 4.0): the plants, descriptions, photos and most attributes.
- [GloBI](https://www.globalbioticinteractions.org) (CC BY 4.0): flower visitors, from published observation records.
- [USDA PLANTS](https://plants.usda.gov) (public domain): bloom colour and period, for North American species.
- You: notes, bloom dates, photos, heights and any blank the other three left, kept in the browser and attributed to nobody but you.

Coverage, counted over the live `plants.json` on 2026-09-27 (8,858 plants):

| Field                   | Plants with a value |
| ----------------------- | ------------------- |
| Height                  | 7,896 (89%)         |
| Edible                  | 6,182 (70%)         |
| Hardiness zone          | 6,012 (68%)         |
| Photo                   | 4,784 (54%)         |
| Guild layer             | 4,651 (53%)         |
| Flower visitors (GloBI) | 3,787 (43%)         |
| Alternate names         | 3,465 (39%)         |
| Bloom colour (USDA)     | 1,043 (12%)         |
| Cautions                | 794 (9%)            |
| Companions              | 206 (2%)            |

Coverage is reported for the search on screen, because the catalogue-wide number misleads: USDA records a colour for 12% of the catalogue but for 677 of the 3,740 plants hardy in zone 6 (18%), and the rail prints the figure for whatever set you are looking at. Cautions are shown in the source's exact words, because "Toxic" and "Toxic fruits" are different sentences to someone standing over an asparagus bed.

The API checks its data on boot and hourly, re-pulls Permapeople once the data is 7 days old (`STALE_AFTER_DAYS` in `server/src/api.mjs`), and re-verifies the 5 stalest plants an hour against GloBI and USDA (`RECHECK_PER_HOUR`), which cycles 8,858 plants in about 74 days. Photos are resized by the API to one of 64, 128, 192, 300, 400, 600 or 800 px (`/img/<id>/<width>.webp`), because Permapeople's CDN has no image service. The Permapeople key lives in the API's environment and never reaches the browser or this repository. The rest is in [docs/data.md](docs/data.md).

## Project layout

```
src/data/        model (the Plant type), store (fetch, cache, lazy name index)
src/lib/         query, constraints, suggest, hardiness, bloom, spots, today;
                 yours: mine, notes, seen, kept, photos, backup;
                 the yard: yards, ground, elevation, growth, sun, yardExport, yardFile
src/state/       search (constraints in; results, counts and trail out)
src/components/  Omnibox, Trail, FacetRail, ResultGrid, GuildView, YardCanvas, YardModel
src/pages/       Browse, Plant, Kept, Yards, Yard, Annual, About
src/styles/      tokens, base, app, browse, detail, kept, yard, annual
server/          the data API: pull, transform, enrich, ingest, resize, serve
```

## Deploy

The front end deploys to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`: `npm ci`, `npm test`, `npm run build`, upload `dist`). The API runs on Railway and deploys from the repository root with `railway up --service api`; the CLI uploads the whole repository whatever directory you run it from, and `railway.json` pins the build and the start command to `server/`. Environment variables and the seed path are in `server/README.md`.

## Testing

`npm test` runs 76 vitest cases in `src/lib/rules.test.ts` (1.8 s here; `npm run typecheck` takes about 26 s). They pin the rules the guide turns on: a lone hardiness number is a floor and a plant with no record never sorts below one the record rules out; every month lands on one of USDA's nine season words; a stroke cannot grow past its cap; your values reach the guide through `ACCESS` without wearing a source's name; only a real measurement stands a figure up; the computed sun behaves like the sky; the ground passes through your marks and settles level beyond them; restoring a backup merges and cannot shrink the phone's own list; importing a yard cannot overwrite one you have; a constraint set survives the URL round trip.

`ci.yml` runs the typecheck and the tests on pull requests (as of this writing it has no recorded run); `deploy.yml` runs the tests and the build on every push to `main` and does not deploy a failing one.

The tests do not cover `evaluate()` itself (the one-pass results, counts and trail), the search box's grammar, the React components, the server, or the data. Upstream records change without notice and nothing here detects a Permapeople field going empty.

## Limitations

None of the data is mine. Records come from Permapeople, flower visitors from GloBI and bloom colour from USDA PLANTS, and their completeness varies plant by plant: a constraint search is only as good as the tags underneath it, so a plant nobody tagged is invisible to the filter that should have found it.

- There is no invasive-species or regional-legality check. A plant that fits your light, soil and moisture may still be a bad idea, or illegal to plant, where you live; ask your local extension office before you buy anything. Only 10 plants carry the Invasive label.
- A hardiness filter drops the 2,846 plants with no recorded zone along with the ones that would die there. The rail says so, and the results still do not contain them.
- Bloom colour and period come from a North American database, so most Old World plants have neither.
- There is no negation. You can find the toxic plants; you cannot ask for the plants that are not toxic (see Roadmap).
- The sun is coarse: crowns are ellipsoids, the day is sampled on the half hour, latitude is kept to the whole degree, and every printed number says "about".
- Everything you write lives in one browser. There is no account and no sync beyond the backup file.
- The model's three.js chunk is 568 kB minified and the build warns about it; it loads only on the Model view.

## Roadmap

1. A negation atom, so "nothing invasive" is expressible. It is deferred because cautions are recorded for 794 of 8,858 plants and the Invasive label for 10, so a "without invasive" filter would certify about 8,000 plants that nobody assessed. It needs better data before it needs a new atom.
2. Flower colour beyond USDA. Permapeople has no such field, USDA covers 1,043 plants, and there is no open structured dataset for it at global scale; it lives in prose, in floras and in Kew's descriptions.

## License

No license chosen yet. The data carries its own licences (see Data).
