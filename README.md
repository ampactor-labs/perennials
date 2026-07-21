# Perennials

A field guide to about 8,800 useful plants, searched by constraint. Say what your site is: the light, the moisture, the soil. Then say what you want from it, and watch the set collapse to what fits. Mobile-first, installs as an offline app, works in a garden with no signal.

Live at [ampactor.dev/perennials](https://ampactor.dev/perennials/).

## What it does

**Constraint-space search.** One bar takes everything: type `wet shade` and it offers both constraints, `zone 6` and it offers the hardiness, `mulberry` and it offers the plant. Each pick becomes a link in a collapse trail (8,800 → Wet 860 → Full shade 58 → Edible 34), and every step is removable. The facet rail splits into *the site, what you have* and *the ask, what you want*, and each option carries a live count of what it would still reach. The whole search lives in the address bar, so a list you build is a link you can send.

**Guild view.** The same results stacked by forest-garden layer, canopy down to roots.

**Spots.** Name a place's conditions once ("north bed", "wet corner") and re-apply them in a tap.

**Yards.** A napkin sketch with the record performing on top. Draw the beds, lay a photo of the ground under the sheet, place any plant in the guide, and scrub the year to watch what is in flower when. The same yard stands up in two more projections: an elevation, recorded heights on a ground line with a height rule, and a 3D model you can orbit, the sheet laid flat with the plants standing on it. Size is a claim in those views, so a plant nobody measured stays a mark on the line rather than growing an invented body, and the figures are the guild layer's shape, never the plant's. Share hands a client one PNG carrying the plan and the elevation, plus a plain-text plant list.

**A page per plant.** Photo, description, the attribute sheet, hardiness, native range, where it has naturalised, functions, edible parts and edible uses, flower visitors, bloom, companions, and any caution the source recorded, in the source's own words.

**The names you'd actually say.** Type "mouse melon" and you get *Melothria scabra*. Nearly two fifths of the catalogue carries common-name synonyms, and all of them are in the index.

**A fourth source: you.** Notes, bloom dates you saw with your own eyes, your photo where the guide has none, and any blank the sources left, filled in your hand. Your values filter, count, sort and draw exactly like the record's, and they always render in your own ink, never under a source's name. Field notes exports everything you have written as one `.json` that restores completely on another phone, beside a plain-text copy that will outlive the app. There is no account and nothing you write leaves the browser.

## The data

Three sources of open data, and the app says which is which — and a fourth that is yours, kept apart from all three.

- **[Permapeople](https://permapeople.org)** (CC BY-SA 4.0). The plants, their descriptions, photos, and most attributes. It serves 65 fields; the transform reads 21. Twice now the thing I went looking for elsewhere was already sitting in a field nobody had read: the 800px photographs, and the alternate names.
- **[GloBI](https://www.globalbioticinteractions.org)** (CC BY 4.0). Flower visitors, from published field observations. Who *actually* turns up at the blooms, rather than who a gardening book supposes might.
- **[USDA PLANTS](https://plants.usda.gov)** (public domain). Bloom colour and bloom period.
- **You.** Notes, bloom dates seen with your own eyes, photos, heights, and any blank the other three left — the fourth source, in your browser only, rendered in your own ink and never attributed to the others. See [Your data](#your-data).

It's real data, so it's uneven, and the interface is built to admit that rather than paper over it. Absence is never dressed up as a fact. A plant with no recorded flower visitors says so, and says that it is not the same as none. Filtering by hardiness quietly excludes the 2,788 plants nobody has recorded a zone for, so the rail says that too. Cautions are shown in the source's exact words, because "Toxic" and "Toxic fruits" are not the same sentence to someone standing over an asparagus bed.

Coverage is reported for the search you are actually running, not for the world. USDA records a bloom colour for 1,038 of 8,800 plants, which reads as 12% and sounds useless. But USDA is a North-American database: once you have said zone 6 and North America it covers 41% of what is in front of you. The catalogue number is true and it misleads, so the facets report the set you are looking at.

The app fetches its dataset from an API of its own (see [`server/`](server/)): a Node service on Postgres, hosted on Railway. It re-pulls Permapeople weekly and re-verifies a few plants an hour against GloBI and USDA, which cycles the whole catalogue in about ten weeks. The catalogue comes down compressed, under a megabyte, once; after that the service worker serves it and the app works with no signal. The Permapeople key lives in the API's environment, never in the browser and never in this repo.

Photos are resized by the API (`/img/<id>/<width>.webp`, 64 to 800). Permapeople's CDN has no image service, so without this every 56-pixel thumbnail was a full-resolution JPEG. It serves two images per plant, a 300px `thumb` and an 800px `title`, and the pipeline read only the small one for a long time; that, not the compression, is why the plant page used to look soft.

## Your data

Everything you write — the kept list, notes, bloom marks, spots, yards, your filled-in values, your photos — lives in this origin's `localStorage` and one IndexedDB database, on your device and nowhere else. There is no account and no server-side copy, which is the privacy property, and it means the backup is the sync: save the `.json` on one phone, open it on another, and the second phone is your guide.

Updates don't touch any of it. The front end is a service-worker PWA (`registerType: "autoUpdate"`): when a new version ships, it downloads in the background and the page reloads itself once to pick it up — no hard refresh, no cache to clear. The service worker only ever manages its own asset caches; it never reads or clears your `localStorage` or IndexedDB, so a deploy is invisible to your data.

The real way to lose local data is the browser reclaiming storage — iOS especially clears a tab's storage after about a week of not visiting. Two things guard against it: **install the app** to your home screen (Field notes offers this; an installed PWA is granted persistent storage and is exempt from that sweep), and **save a copy** now and then (Field notes → Your copy). The app already requests persistent storage the first time you write anything.

## Stack

Vite, React, TypeScript. MiniSearch for the name index, built on idle rather than on load. Faceted filtering and the live counts are plain in-memory JS, one pass over the catalogue per interaction. `vite-plugin-pwa` (Workbox) precaches the shell and runtime-caches the data and photos. three.js draws the yard's 3D model and rides in a lazy 139KB-gzipped chunk that loads only when a Model view mounts; the service worker precaches it, so the model still raises offline, and the guide's own bundle stays near 100KB gzipped without it. The look is a hand-rolled CSS design system, a herbarium specimen catalog in light and dark, whose one rule is that saturated colour only ever encodes plant data; the chrome stays ink on paper.

## Run

```sh
npm install
npm run dev      # fetches the dataset from the hosted API
npm run build    # typecheck + production build
npm run preview  # serve the build
```

Point it at a different backend with `VITE_DATA_API` at build time, and add a matching service-worker cache rule in `vite.config.ts`.

## Deploy

The front end ships to GitHub Pages on push to `main`. The API deploys from the **repository root** (`railway up --service api`). The Railway CLI uploads the whole git repo regardless of the working directory, and `railway.json` pins the build to `server/`. See `server/README.md`.

## Project layout

```
src/data/       model (types), store (fetch, cache, lazy name index, her
                values folded into the dataset)
src/lib/        query (facets, one-pass evaluation, live counts), constraints
                (the atom model + URL codec), suggest (the omnibox grammar),
                spots, bloom, img, hardiness, homeZone; hers: mine, notes,
                seen, kept, photos, backup, latitude, phenology; the yard:
                yards, elevation, growth, sun, yardExport, yardFile
src/state/      search (constraints in; results, counts and trail out)
src/components/ Omnibox, Trail, FacetRail, SpotBar, ResultGrid, PlantCard,
                GuildView, Thumb, Layout, InstallHint; the yard: YardCanvas,
                ElevationView, YardModel, YearScrubber; hers: AddMine,
                NotePanel, BloomCalendar, SeenMark, BackupPanel
src/pages/      Browse, Plant, Kept, Yards, Yard, About
src/styles/     tokens, base, app, browse, detail, kept, yard
server/         the data API: pull, transform, enrich, ingest, resize, serve
```

## Where it's going

A negation atom, so "nothing invasive" is expressible and not just "find me the invasive ones". I keep deferring it for a reason: cautions are recorded for only 791 of the 8,800 plants, so a "without invasive" filter would quietly certify 8,000 plants that nobody ever assessed. That is exactly the false confidence the rest of this is built to avoid. The honest version needs better data, not a new atom.

Flower colour is the other gap, and it is not ours. Permapeople has no such field. USDA has the plant 58% of the time and records a colour for 13% of those. Wikidata does not have it for yarrow, comfrey, or bee balm. It lives in prose, in floras and in Kew's descriptions, and there is no open structured dataset for it at global scale.
