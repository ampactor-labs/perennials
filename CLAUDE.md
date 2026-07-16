# Perennials

Offline-first PWA field guide over about 8,800 useful plants. React + TypeScript + Vite on
the front end, a Node and Postgres data API on the back end (`server/`), hosted on Railway.
The app fetches its dataset from the API and runs all search and faceted filtering in the
browser. Full overview in README.md.

## The data

Three sources, all open horticultural reference data: cultivation needs, uses, native
range, and the standard attributes any plant field guide carries.

- Permapeople (permapeople.org), CC BY-SA 4.0. The plants and most attributes.
  It serves 65 fields and the transform reads 21 of them. Before adding a source,
  check whether Permapeople already carries the thing: that is how the 800px photos
  and the alternate names turned up, both of which had been sitting there ignored.
- GloBI (globalbioticinteractions.org), CC BY 4.0. Observed flower visitors.
- USDA PLANTS, public domain. Bloom colour and period.

The dataset is not committed to this repo. The API (`server/`) pulls, normalizes and
enriches it, then serves it as JSON, so there is no large data file here to load into
context. To work on the data path, read `server/`.

The governing rule, in the data and in the UI: **absence is never presented as a fact.**
A field nobody recorded reads as "not recorded", never as "no". Cautions are shown in the
source's exact words, because "Toxic" and "Toxic fruits" are not the same sentence to
someone standing over an asparagus bed. If you add a facet whose coverage is partial, it
has to print its coverage.

## Layout

- `src/` the app: `components/`, `pages/`, `state/`, `lib/`, `data/`, `styles/`
- `server/` the data API (Node + Postgres): pull, transform, enrich, ingest, resize, serve

The look is a hand-built CSS design system, a herbarium specimen catalog in light and dark.
Its one rule, stated in `tokens.css`: saturated colour only ever encodes plant data (bloom
swatches, function tags); the chrome stays ink-on-paper monochrome. It's deliberate; leave
the visual design and UX intact unless asked to change them.

## Commands

- `npm run dev` dev server
- `npm run typecheck` the real typecheck
- `npm run build` typecheck + production build
- `npm test` the rules in `src/lib/rules.test.ts`
- `server/` has its own commands; see `server/README.md`

The tests cover the rules the guide turns on and nothing else: what a hardiness
record means, that a plant nobody measured never sorts below one the record rules
out, that a month lands on exactly one of USDA's nine season words, that a stroke
cannot grow past its cap. They exist because "a lone hardiness number is a floor,
not a one-zone window" was wrong for months and dropped Red mulberry and hardy
kiwi out of a zone-6 search, and nothing was watching. Put a rule here the day you
rely on it.

**Do not run `tsc --noEmit`.** `tsconfig.json` is a solution-style config (`"files": []`
plus project references), so a bare `tsc --noEmit` compiles nothing and exits 0 no matter
how broken the code is. It will tell you the app typechecks while it does not. Use
`npm run typecheck` (`tsc -b --noEmit`), which is what `npm run build` runs.

## Deploying

The front end ships to GitHub Pages on push to `main`.

The API deploys from the **repository root**, not from `server/`:

    railway up --service api

The Railway CLI uploads the whole git repository regardless of the working directory. Run
it from `server/` and it still uploads the root, Nixpacks finds the Vite app at the top
level, and the API is silently replaced by a static site serving `index.html`. `railway.json`
at the root pins the build to `server/` so that cannot happen.
