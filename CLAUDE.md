# Perennials

Offline-first PWA field guide over about 8,800 useful plants. React + TypeScript + Vite on
the front end, a Node and Postgres data API on the back end (`server/`), hosted on Railway.
The app fetches its dataset from the API and runs all search and faceted filtering in the
browser. Full overview in README.md.

## The data

Plant records come from Permapeople (permapeople.org), an open, community-built botanical
database, licensed CC BY-SA 4.0. It's ordinary open horticultural reference data:
cultivation needs, uses, native range, and the standard attributes any plant field guide
carries. The dataset is not committed to this repo. The API (`server/`) pulls and
normalizes it from Permapeople and serves it as JSON, so there is no large data file here
to load into context. To work on the data path, read `server/`.

## Layout

- `src/` the app: `components/`, `pages/`, `state/`, `lib/`, `data/`, `styles/`
- `server/` the data API (Node + Postgres): pull, transform, ingest, serve

The look is a hand-built CSS design system, a herbarium specimen catalog in light and dark.
It's deliberate; leave the visual design and UX intact unless asked to change them.

## Commands

- `npm run dev` dev server
- `npm run build` typecheck + production build
- `server/` has its own commands; see `server/README.md`
