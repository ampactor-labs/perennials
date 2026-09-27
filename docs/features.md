# What the app does

A tour of the screens, kept out of the README for length. Every claim here is about the code as of 2026-09-27; the counts are from the live catalogue on that day (see [data.md](data.md)).

## Search by constraint

One search box takes everything. Type `wet shade` and it offers both conditions; type `zone 6` and it offers the hardiness zone; type `mulberry` and it offers the plant. The synonym table in `src/lib/suggest.ts` maps gardener words to facet values (`bog` to Wet, `clay` to Heavy soil, `hedge` to Hedgerow, `bee` to Bees), and a phrase that resolves across facets offers all of them. Each pick becomes a step in a collapse trail that shows how the set narrows (the whole catalogue, then Wet, then Full shade, then Edible, each with its count), and every step can be removed. Within one facet the test is OR, so a second Light value widens the set; the trail shows one step per facet with the union, which keeps the counts falling as you read down.

The facet rail splits into "The site, what you have" (light, water, soil) and "The ask, what you want" (layer, life cycle, growth rate, bloom colour, bloom period, edible parts, function and use, attracts, family, native to). Cautions are a third group, because selecting Toxic finds the toxic plants, and filing that under "what you want" said the opposite of what it means. Each option carries a live count of what it would still reach, holding every other constraint fixed, and a facet with partial coverage prints how many of the plants on screen have any value for it. The whole search is encoded in the URL, so a list you build is a link.

Results rank by text relevance when you are typing a name, and otherwise by the catalogue's documentation-richness score banded by your home zone: plants that can live where you garden first, the unmeasured in the middle, the recorded misfits last (`src/lib/homeZone.ts`). The zone starts at 6 and re-learns itself every time you name one in a search.

## Guild view

The same results stacked by forest-garden layer, canopy down to roots: tall trees, trees, shrubs, vines, herbs, ground cover, roots. A layer only you recorded shelves the plant in that section.

## Spots

Name a place's conditions once ("north bed", "wet corner") and re-apply them in a tap. A spot stores light, water and soil under a name in `localStorage`.

## A page per plant

Photo, description, the attribute sheet, hardiness, native range, where it has naturalised, functions, edible parts and edible uses, flower visitors, bloom, companions, and any caution the source recorded, in the source's own words. Links go to Wikipedia, Plants For A Future, Plants of the World Online and the Permapeople record.

## The names you would say

Type "mouse melon" and you get *Melothria scabra*. 3,465 of 8,858 plants (39%) carry common-name synonyms, and all of them are in the name index, which searches name, alternate names, scientific name and family with prefix and fuzzy matching (`src/data/store.tsx`).

## Yards

A yard is a napkin sketch with the record drawn on top. Draw the beds, lay a photo of the ground under the sheet, tap in the heights you know (a bank at +1.5 m, a pond at -0.5 m) and place any plant in the guide, then scrub the year to watch what is in flower when.

The same yard stands up in two more projections. The elevation is a section through the land with each plant at its own footing against a height rule. The model is a three.js scene you can orbit or walk into at eye height, the sheet draped over the same ground. Size is a claim in those views: a plant nobody measured stays a mark on the line and grows no invented body; figures are the guild layer's archetype, because there is no open dataset of species silhouettes and inventing one per plant would add false confidence in a new dimension; the ground bends only through heights you set and settles level where you set none (`src/lib/ground.ts`). A recorded growth pace (slow, moderate, fast) draws as a band between a fast and a slow reading of the word, and a plant with no recorded pace is drawn at maturity with the gap said out loud (`src/lib/growth.ts`).

Share hands a client one PNG carrying the plan (with the hour's shade when you have drawn it) and the elevation, a plant list as plain text, and a `.json` yard file another phone can open. An imported yard whose id collides with one already on the phone is admitted under a fresh id, so an import cannot overwrite a yard you have (`src/lib/yardFile.ts`).

## The sun

Give the sheet your latitude (kept to the whole degree) and a span in metres and the sun is computed: each drawn bed reports its hours of direct light, the Ask tool reads any tapped point, and Draw the shade washes the hour's shadow over the plan, crowns and land included, with play sweeping the hour across the day. Every answer is one of the catalogue's own light words (`tierWord` in `src/lib/sun.ts`), so one tap opens the guide filtered to what would live in that spot. Without both numbers nothing is cast and nothing is guessed. The geometry is coarse on purpose: crowns are ellipsoids and the day is sampled on the half hour, so every printed number says "about".

## The year

The bloom wheel from the Kept list mounts over a yard's placed plants too, with its gaps named. Under it, one line says which blooming months have no recorded flower visitor and another which guild strata nobody has placed, both scoped to coverage so that a missing record is never read as a famine or an empty layer (`src/lib/phenology.ts`). Browse opens under a Today strip: the season, and which of your plants are recorded in bloom right now, your own marks in your own ink (`src/lib/today.ts`). `/annual` typesets a year of your record (blooms you marked, notes, the wheel, every yard's sheet, your photographs) for the browser's own print-to-PDF; it reads every store and writes none.

## The fourth source: you

Notes, bloom dates you saw yourself, your photo where the guide has none, and any blank the sources left, filled in your hand. Your values filter, count, sort and draw exactly like the record's, they render in sepia, and they are never attributed to a source. The "+" that offers to fill a field appears only where the sources gave nothing. Field notes exports everything you have written as one `.json` that restores completely on another phone, beside a plain-text copy that outlives the app. There is no account, and nothing you write leaves the browser. Storage details are in [data.md](data.md#your-data).
