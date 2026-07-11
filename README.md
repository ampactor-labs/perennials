# Perrenials

A field guide and yard planner for permaculture perennials. Mobile-first, installs as an offline app, no backend.

Search the way a gardener actually thinks — "show me perennials that bloom yellow, love wet shade, and feed bees" — and get plants you can plant and arrange.

## What it does

- **Search by real aspects.** Bloom color, sun, soil moisture, mature height, hardiness zone, wildlife value, growth rate, ease, self-seeding — and the permaculture functions the book cares about: nitrogen fixer, dynamic accumulator (and which minerals), groundcover, insectary. Filters combine, and each option shows how many plants it would return.
- **A field-guide entry per plant.** The spec sheet, where it sits in the forest-garden layer cake, the minerals it accumulates with Jacke's confidence rating, who it feeds, what it's good for as food and medicine, what it tells you about the soil when it shows up wild, and the cautions worth knowing.
- **A garden sketch.** Filter to what you want, then drop those plants onto a plot measured in feet. Each footprint is drawn at the plant's true mature spread, so the spacing you see is the spacing you'd plant. Comes seeded with a west-perimeter windbreak and a wet corner.

## The data

The starter set of 43 temperate perennials is modeled on the species-by-function and species-by-use tables in *Edible Forest Gardens, Vol. 2* (Dave Jacke & Eric Toensmeier) — dynamic accumulators, best medicinal plants, indicator species — cross-checked against Plants For A Future and USDA PLANTS. Every plant records its sources. Anything not verified is left blank and named, never guessed; hardiness in particular is never invented. It defaults to USDA zone 6, the zone of the book's Holyoke case study, and remembers whatever you set.

This is a seed, not a census: a few dozen well-described plants rather than a thin thousand.

## Stack

Vite, React, TypeScript. MiniSearch runs the fuzzy text box in the browser; the facet filtering is plain in-memory JS over the dataset. `vite-plugin-pwa` (Workbox) handles the offline install. There is no server — the plant data ships as a static bundle, so the whole thing is a static site. The look is a hand-rolled CSS design system (no UI kit): a herbarium specimen catalog, where saturated color only ever encodes plant data and the chrome stays ink-on-paper.

## Run

```sh
npm install
npm run dev        # dev server
npm run build      # typecheck + production build
npm run preview    # serve the built app
npm run gen:icons  # regenerate PWA icons from public/favicon.svg
```

## Project layout

```
src/data/     vocab (the controlled vocabulary every facet draws from),
              types, plants.ts (the dataset), index.ts (load + derive)
src/lib/      filters (facet registry, predicate, live counts),
              search (MiniSearch + combined query), settings
src/state/    catalog context — filters in, results and counts out
src/components/ SearchBar, QuickAsks, FacetPanel, PlantCard, LayerSpine, …
src/pages/    Compendium, Plant, Garden, About
src/styles/   tokens, base, app, detail
```

## Where it's going

- Grow the dataset past the starter 43, with a source-cited import from PFAF, Permapeople and USDA.
- The garden view is a working seed. Next: a section / "layer cake" side view, sun and shade across the day, and saved plots.
- Plant photos from Wikimedia, companion and guild links between entries, and shareable search URLs.
