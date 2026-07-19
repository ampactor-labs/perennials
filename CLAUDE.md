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
- Her. The fourth source, and the only one that has seen the actual yard: notes,
  bloom dates, and the blanks she fills in herself (`lib/mine.ts`, `lib/photos.ts`).
  It is hers, it is not CC BY-SA, and it never leaves the browser.

The three source lanes and hers never mix. Source values are never edited and her
answers are never attributed to a source, which is why `Plant` (`data/model.ts`) is
exactly what the API gave us and her values ride beside it in `Dataset.mine` instead
of inside it. That separation is the licence boundary as much as the design one.
Everything of hers renders in sepia (`ptag--mine`), and the "+" that offers to fill a
field only ever appears where our sources gave nothing.

The dataset is not committed to this repo. The API (`server/`) pulls, normalizes and
enriches it, then serves it as JSON, so there is no large data file here to load into
context. To work on the data path, read `server/`.

The governing rule, in the data and in the UI: **absence is never presented as a fact.**
A field our sources didn't fill reads as "not in our sources", never as "no", and never
as "nobody recorded it" either. That second one is the subtler trap: somebody has almost
certainly measured this plant's bloom colour somewhere, and all we actually know is that
the three sources we pull didn't hand it to us, or that our transform didn't take it.
Scope every absence claim to our own data, because that is the only claim we can back.
Cautions are shown in the source's exact words, because "Toxic" and "Toxic fruits" are not
the same sentence to someone standing over an asparagus bed. If you add a facet whose
coverage is partial, it has to print its coverage.

The rule binds us, not her. We don't invent a value to fill a gap; she is standing in
front of the plant and may fill any gap she likes, and once she has, it counts for real:
her values filter, land in the facet rail with their own counts, move coverage, feed the
suggestions, and sort by zone. That works because `ACCESS` in `lib/query.ts` is the single
place the guide asks what a plant is. Fold a new reader in there and every one of those
follows; read a plant's fields directly anywhere else and the rest of that list silently
won't. The one thing her values may never do is claim to be a source's.

The yard (`lib/yards.ts`, `pages/YardPage.tsx`) is her sheet with the record performing
on top, in three projections: plan, elevation, model. In the vertical two, size is a
claim, so a plant with no height in our data draws no figure and stands as a mark on the
line; heights parse through `lib/elevation.ts` (record first, hers where it is silent),
and figures are the recorded guild layer's archetype, never a shape invented per plant.
The exported sheet re-renders plan and elevation from the same geometry with the licence
line baked in.

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
record means, that a plant we have no measurement for never sorts below one the record rules
out, that a month lands on exactly one of USDA's nine season words, that a stroke
cannot grow past its cap, that restoring a backup never costs her an entry, and that her
own values reach the guide without ever wearing a source's name. They exist because "a lone
hardiness number is a floor, not a one-zone window" was wrong for months and dropped Red
mulberry and hardy kiwi out of a zone-6 search, and nothing was watching. Put a rule here
the day you rely on it.

## Her copy is the sync

Field notes writes two files: a `.json` that restores all eight stores including her
photos, and a `.txt` that outlives the app. Import the `.json` on another machine and
that machine has her guide; there is no account, no server-side user data and no PII
anywhere in this project, and that is a feature to defend rather than a gap to close.
Restore defaults to merge (newest wins per entry), because the realistic restore is her
second device and wiping the phone she is holding would be data loss wearing a feature's
clothes.

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
