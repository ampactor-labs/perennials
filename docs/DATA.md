# Data notes

Longer notes behind the README's [Data](../README.md#data) section. The
service that pulls and serves the data is documented in
[server/README.md](../server/README.md).

## What the transform reads

Permapeople serves each plant as a list of key and value attributes.
[`server/src/transform.mjs`](../server/src/transform.mjs) reads 22 of those keys,
from `Family` and `Light requirement` to `Plants of the World Online`, and
normalizes them into the `Plant` type in
[`src/data/model.ts`](../src/data/model.ts).

Before adding a source, check whether Permapeople already carries the thing. The
800px photos and the alternate names both turned up that way, in fields the
pipeline had not been reading.

GloBI (Global Biotic Interactions) supplies flower visitors from published field
observations. The app groups them as bees, butterflies, hoverflies, beetles,
wasps, moths, flies and hummingbirds. A group appears on a plant when a published
record has a member of it visiting or pollinating that plant. USDA PLANTS supplies bloom colour and bloom
period, for North-American species only.

## Coverage is reported for your search

A catalogue-wide coverage number can mislead. USDA records a bloom colour for
1,043 of the 8,858 plants, which is 12% and sounds useless. USDA is a
North-American database, though. For plants hardy in zone 6 and native to New
York, the same field covers 237 of 613 (39%). The facet rail reports the second
kind of number: how many of the plants in the current results have a value.

Hardiness works the same way. 2,846 plants have no recorded USDA zone, and a
zone filter sets them aside because it cannot place them. The rail says how many
were set aside for that reason, so the count does not read as a statement about
survival.

## Photos

The API resizes photos to WebP at `/img/<plant id>/<width>.webp`, in widths of
64, 128, 192, 300, 400, 600 and 800 pixels. Permapeople's CDN has no image
service, so before this every 56-pixel thumbnail was a full-resolution JPEG.
Permapeople serves two images per plant, a 300px `thumb` and an 800px `title`.
For a long time the pipeline read only the small one, which is why the plant
page used to look soft.

## Download size

`plants.json` is 11.5 MB of JSON. The API serves it at 1.34 MB with brotli and
1.78 MB with gzip (measured with `curl` on 2026-09-26). The app downloads it
once, and after that the service worker serves it from cache.

## How the counts were measured

The counts in the README and in [FEATURES.md](FEATURES.md) come from the live
API on 2026-09-26, whose `meta.json` reports data generated on 2026-09-23. They
move with each weekly refresh. To reproduce them, save this as `count.mjs`:

```js
import { readFileSync } from "node:fs";
const plants = JSON.parse(readFileSync("plants.json", "utf8"));
const n = plants.length;
const row = (label, has) => {
  const c = plants.filter(has).length;
  console.log(`${label.padEnd(16)} ${String(c).padStart(5)}  ${Math.round((c / n) * 100)}%`);
};
console.log(`plants           ${n}`);
row("hardiness", (p) => p.hardiness);
row("photo", (p) => p.thumb);
row("flower visitors", (p) => p.attracts?.length);
row("alternate names", (p) => p.altNames.length);
row("bloom colour", (p) => p.bloomColor);
row("bloom period", (p) => p.bloomPeriod);
row("caution text", (p) => p.cautions);
row("companions", (p) => p.companions?.length);
// Zone 6 as the app reads it (src/lib/hardiness.ts): a lone number is a floor.
const hardyIn6 = (h) => h && 6 >= h.min && (h.max === null || h.max === h.min || 6 <= h.max);
const ny = plants.filter((p) => hardyIn6(p.hardiness) && p.nativeTo.includes("New York"));
console.log(`zone 6 + New York: bloom colour for ${ny.filter((p) => p.bloomColor).length} of ${ny.length}`);
const wet = plants.filter((p) => p.water.includes("Wet"));
const shade = wet.filter((p) => p.light.includes("Full shade"));
console.log(`trail: ${n} → Wet ${wet.length} → Full shade ${shade.length} → Edible ${shade.filter((p) => p.edible).length}`);
```

Then run it next to a fresh copy of the data:

```sh
curl -sS --compressed -o plants.json https://api-production-5338.up.railway.app/data/plants.json
node count.mjs
```

Output on 2026-09-26:

```
plants           8858
hardiness         6012  68%
photo             4784  54%
flower visitors   3786  43%
alternate names   3465  39%
bloom colour      1043  12%
bloom period      1076  12%
caution text       794  9%
companions         206  2%
zone 6 + New York: bloom colour for 237 of 613
trail: 8858 → Wet 860 → Full shade 58 → Edible 34
```

The service reports some of the same counts live at
`https://api-production-5338.up.railway.app/health`.
