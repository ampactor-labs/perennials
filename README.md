# Perrenials

A field guide and yard planner for permaculture perennials. Mobile-first, installs as an offline app, no backend.

Search the way a gardener actually thinks — "show me perennials that bloom yellow, love wet shade, and feed bees" — and get plants you can plant and arrange.

## What it does

- **Search by real aspects.** Bloom color, sun, soil moisture, mature height, hardiness zone, wildlife value, growth rate, ease, self-seeding — and the permaculture functions the book cares about: nitrogen fixer, dynamic accumulator (and which minerals), groundcover, insectary. Filters combine, and each option shows how many plants it would return.
- **A field-guide entry per plant.** The spec sheet, where it sits in the forest-garden layer cake, the minerals it accumulates with Jacke's confidence rating, who it feeds, what it's good for as food and medicine, what it tells you about the soil when it shows up wild, and the cautions worth knowing.
- **A garden sketch.** Filter to what you want, then drop those plants onto a plot measured in feet. Each footprint is drawn at the plant's true mature spread, so the spacing you see is the spacing you'd plant. Comes seeded with a west-perimeter windbreak and a wet corner.

## The data

Two layers, and the app is honest about which is which.

The permaculture traits (function: nitrogen fixer, dynamic accumulator and its minerals, groundcover, insectary; edible and medicinal use; forest-garden layer; hardiness) are curated by hand across the 43 plants, modeled on the species tables in *Edible Forest Gardens, Vol. 2* (Jacke & Toensmeier) and cross-referenced with Plants For A Future. Uncertain values are left blank and named, never guessed.

The botanical facts are fetched by a build-time pipeline and every field records where it came from: accepted names and families from GBIF, native-vs-introduced status and invasive listings from USDA PLANTS, descriptions and photographs from Wikipedia and Wikimedia Commons. The result is committed to `src/data/generated/`, so the shipped app stays a static offline PWA with no runtime fetching. Each plant's page shows which source supplied which field, and flags anything USDA lists as invasive in the US.

Run `npm run data:build` to refresh. Responses cache under `scripts/data/.cache`, so re-runs are fast and polite to the APIs. It defaults to USDA zone 6 (the book's Holyoke case study) and remembers whatever you set.

Still a seed, not a census: a few dozen well-described plants rather than a thin thousand.

## Stack

Vite, React, TypeScript. MiniSearch runs the fuzzy text box in the browser; the facet filtering is plain in-memory JS over the dataset. `vite-plugin-pwa` (Workbox) handles the offline install. There is no server — the plant data ships as a static bundle, so the whole thing is a static site. The look is a hand-rolled CSS design system (no UI kit): a herbarium specimen catalog, where saturated color only ever encodes plant data and the chrome stays ink-on-paper.

## Run

```sh
npm install
npm run dev        # dev server
npm run build      # typecheck + production build
npm run preview    # serve the built app
npm run gen:icons  # regenerate PWA icons from public/favicon.svg
npm run data:build # re-fetch the open-source enrichment (needs network)
```

## Project layout

```
src/data/       vocab (the controlled vocabulary every facet draws from),
                types, plants.ts (curated dataset), index.ts (load + merge),
                enrichment.ts + generated/ (the fetched, source-cited layer)
src/lib/        filters (facet registry, predicate, live counts),
                search (MiniSearch + combined query), settings
src/state/      catalog context: filters in, results and counts out
src/components/ SearchBar, QuickAsks, FacetPanel, PlantCard, LayerSpine,
                PlantEnrichment (photo, origin, receipts), …
src/pages/      Compendium, Plant, Garden, About
src/styles/     tokens, base, app, detail
scripts/data/   the enrichment pipeline: sources/ (GBIF, USDA, Wikipedia),
                reconcile, build; writes src/data/generated/
```

## Where it's going

- Grow the dataset past 43. The pipeline makes it cheap: add species, re-run `data:build`. A permaculture-trait source (Practical Plants, Permapeople) would fill function, use and layer for new plants the way GBIF and USDA already fill the botanical facts.
- The garden view is a working seed. Next: a section / "layer cake" side view, sun and shade across the day, and saved plots.
- Companion and guild links between entries, a native-only filter, and shareable search URLs.
