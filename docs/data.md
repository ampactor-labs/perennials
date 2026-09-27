# The data

Where the catalogue comes from, how much of it is filled in, how it refreshes, and where what you write is kept. The counts below were measured on 2026-09-27 over `plants.json` fetched from the live API (`https://api-production-5338.up.railway.app/data/plants.json`) with a short node script that counts non-empty fields, the same way the About page counts them in the browser; the API's `/health` endpoint reported the same totals.

## Sources and licences

- **Permapeople** (permapeople.org, CC BY-SA 4.0). The plants, their descriptions, photos and most attributes. `server/src/transform.mjs` reads 22 named fields from each record: Alternate name, Edible, Edible parts, Edible uses, Family, Growth, Height, Introduced into, Layer, Life cycle, Light requirement, Medicinal, Native to, Plants For A Future, Plants of the World Online, Soil type, USDA Hardiness zone, Utility, Warning, Water requirement, Width and Wikipedia, plus the record's name, scientific name, description, link and two image URLs. Twice the thing I went looking for elsewhere was already in a field the pipeline had not read: the 800 px photographs and the alternate names.
- **GloBI** (globalbioticinteractions.org, CC BY 4.0). Flower visitors, from published field observations: who has been recorded at the blooms.
- **USDA PLANTS** (plants.usda.gov, public domain). Bloom colour and bloom period. It is a North American database, so it covers the plants you would put in the ground there and little else.
- **You.** Notes, bloom dates, photos, heights and any blank the other three left. Kept in your browser, rendered in sepia, and attributed to nobody but you. See [Your data](#your-data).

The three source lanes and yours do not mix. Source values are never edited, your answers are never attributed to a source, and `Plant` (`src/data/model.ts`) is exactly what the API sent while your values ride beside it in `Dataset.mine`. That separation is the licence boundary as much as the design one.

## Coverage

The dataset is uneven, and the interface admits it. A plant with no recorded flower visitors says so, and says that this differs from having none. Cautions appear in the source's exact words, because "Toxic" and "Toxic fruits" are different sentences to someone standing over an asparagus bed. A blank reads "not in our sources": somebody has almost certainly measured the plant's bloom colour somewhere, and all we know is that the sources we pull did not hand it to us.

Counted over the live catalogue on 2026-09-27 (8,858 plants):

| Field                                                            | Plants with a value | Source      |
| ---------------------------------------------------------------- | ------------------- | ----------- |
| Plants of the World Online link                                  | 7,898 (89%)         | Permapeople |
| Height                                                           | 7,896 (89%)         | Permapeople |
| Edible                                                           | 6,182 (70%)         | Permapeople |
| Hardiness zone                                                   | 6,012 (68%)         | Permapeople |
| Photo                                                            | 4,784 (54%)         | Permapeople |
| Guild layer                                                      | 4,651 (53%)         | Permapeople |
| Flower visitors                                                  | 3,787 (43%)         | GloBI       |
| Alternate names                                                  | 3,465 (39%)         | Permapeople |
| Bloom period                                                     | 1,076 (12%)         | USDA PLANTS |
| Bloom colour                                                     | 1,043 (12%)         | USDA PLANTS |
| Cautions, verbatim                                               | 794 (9%)            | Permapeople |
| Caution labels (Toxic, Invasive, Weed potential, Lookalike risk) | 791 (9%)            | derived     |
| Companions                                                       | 206 (2%)            | Permapeople |

Only 10 plants carry the Invasive label, which is why a "without invasive" filter is not offered (see the README's Roadmap).

The rail reports coverage for the search you are running, because the catalogue-wide number misleads. USDA records a bloom colour for 1,043 of 8,858 plants, which reads as 12%; among the 3,740 plants hardy in zone 6 it covers 677 (18%). `evaluate()` in `src/lib/query.ts` counts, for each facet, how many of the plants on screen have any value for it, and `FacetRail` prints the figure whenever it is below the total.

Hardiness is the constraint people trust most and the one whose absence shows least. A hardiness filter excludes the 2,846 plants with no recorded zone exactly as it excludes the ones that would die there, so "hardy in zone 6, 3,740 plants" is partly a claim about paperwork, and the rail prints the zone coverage beside the control. A lone recorded number is a cold-hardiness floor ("hardy to zone 5" survives zone 6 too), and the transform writes `max: null` for it; an earlier version fabricated a top from the lone number, which read Chokecherry's "1" as "zone 1 only" and dropped it from a zone-6 search. `npm test` pins that rule.

## How the API keeps it fresh

The API (`server/`, Node and Postgres on Railway) checks its data on boot and hourly. Once the data is 7 days old it re-pulls the whole Permapeople catalogue (`STALE_AFTER_DAYS` in `server/src/api.mjs`), keeps the enrichment already paid for, and enriches the newcomers. Every hour it also re-verifies the 5 stalest plants against GloBI and USDA (`RECHECK_PER_HOUR`), which cycles 8,858 plants in about 74 days. Sweeps are resumable: a failed lookup leaves the field NULL and is retried, while a plant that was checked and has nothing keeps its empty result. `/health` reports the plant count, the data's age, each sweep's progress and the outcome of the last pull.

The three payloads are built once per change, compressed and ETagged on their own bytes. On 2026-09-27 `plants.json` was 11,465,369 bytes raw, 1,777,630 gzip and 1,337,891 brotli; the app downloads it once and the service worker serves it after that, with an hour's `max-age` and a content-addressed ETag for revalidation.

Photos are resized by the API (`/img/<id>/<width>.webp`, widths 64, 128, 192, 300, 400, 600 and 800), because Permapeople's CDN has no image service and every 56-pixel thumbnail used to be a full-resolution JPEG. Permapeople serves two images per plant, a 300 px `thumb` and an 800 px `title`; for a long time the pipeline read only the small one, which is why the plant page looked soft, and the resizer now works from the 800 px image at every size and never enlarges. Permapeople's shared placeholder image is detected (any URL used by more than three species) and nulled, so a card without a photo says so.

The Permapeople key lives in the API's environment and does not reach the browser or this repository; without it the API seeds itself from the last published dataset.

## Your data

Everything you write lives in this origin's `localStorage` under nine `perennials.*` keys (`zone`, `kept`, `lat`, `mine`, `notes`, `seen`, `spots` and `yards`, each versioned `.v1`, plus `theme`) and in one IndexedDB database, `perennials-photos`. Photos go to IndexedDB because a phone photo is 2 to 4 MB and the whole origin gets about 5 MB of localStorage; they are downscaled to 1400 px on the long edge first, which lands around 200 KB each (`src/lib/photos.ts`).

There is no account and no server-side copy, so the backup is the sync. Field notes writes two files: a `.json` that round-trips every store, photos included as data URLs, and a `.txt` that outlives the app. Restoring merges by default, a union by identity with the newest entry winning, because the realistic restore is your second device and wiping the phone you are holding would be data loss wearing a feature's clothes; replace is the only mode that discards what is on the phone (`src/lib/backup.ts`). A single yard travels the same way (`src/lib/yardFile.ts`), and an imported yard whose id collides with one you have is admitted under a fresh id.

Updates do not touch your data. The service worker (`registerType: "autoUpdate"` in `vite.config.ts`) precaches the app shell, swaps it when a new version ships and reloads once; it only ever clears its own Cache Storage. The one way to lose data in code is to rename a store key without a migration, so new fields are added as optional and the `.v1` suffix stays.

The real-world loss vector is the browser evicting script storage. iOS clears a browser tab's storage after about seven days without a visit, which is how a seasonal field guide gets used, and an installed app is exempt. So the app asks for persistent storage on your first write (`navigator.storage.persist()` in `src/lib/localStore.ts`), the Field notes page offers to install to the home screen, and the backup is the floor under all of it.
