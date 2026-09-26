# Features

A tour of what the guide does. The README's [Usage](../README.md#usage) section
has the short version. Counts on this page come from the live dataset on
2026-09-26 (8,858 plants, generated 2026-09-23); see [DATA.md](DATA.md) for how
they were counted.

## Constraint search

One bar takes everything. Type `wet shade` and it offers both constraints. Type
`zone 6` and it offers the hardiness filter. Type `mulberry` and it offers the
plant. A USDA hardiness zone is a band of average winter minimum temperature,
and a plant "hardy in zone 6" survives winters there.

Each pick becomes a step in a collapse trail that shows how many plants are left
after it. A search for wet ground, full shade and edible plants reads
8,858 → Wet 860 → Full shade 58 → Edible 34. Every step is removable.

The facet rail has three groups: "the site, what you have" (light, water,
soil), "the ask, what you want" (layer, uses, edible parts, bloom, flower
visitors, native range and more) and "cautions, what to watch for". A hardiness
zone picker and an edible-only switch sit above them. Each option carries a live
count of the plants it would still reach. Where a facet's data is partial, the
rail prints how many of the plants in front of you have a value for it. Once a
zone is set, it also says how many plants were set aside only because the data
has no hardiness for them.

The whole search lives in the address bar, so a list you build is a link you can
send. The search above is `?water=Wet&light=Full+shade&edible=1`.

## Guild view

The same results stacked by forest-garden layer, from tall trees down to roots.
A guild, in permaculture, is a group of plants grown together so that each
layer of a planting is used.

## Spots

Name a place's conditions once ("north bed", "wet corner") and re-apply them in
a tap.

## Plant pages

Each plant has a page with its photo, description and attribute sheet. It shows
hardiness, native range and where the plant has naturalised. It lists
functions, edible parts, edible uses, flower visitors, bloom and companions.
Any caution the source recorded appears in the source's own words.

## Common names

Type "mouse melon" and you get *Melothria scabra*. 3,465 of the 8,858 plants
(39%) carry alternate common names, and all of them are in the search index.

## Yards

A yard is a sketch of a real plot with the record drawn on top. Draw the beds,
lay a photo of the ground under the sheet, and tap in the heights you know (the
bank +1.5 m, the pond −0.5 m). Place any plant from the guide, then scrub
through the year to see what is in flower when.

The same yard has two more projections. The elevation is a section through the
land, with each plant at its own footing against a height rule. The 3D model can
be orbited or walked into, with the sheet draped over the same ground. In those
views a plant's size is a claim. A plant with no recorded height stays a mark on
the line and gets no figure. Figures use the guild layer's shape and are never
drawn per plant. The ground bends only through the heights you set and settles
level where you set none.

Share produces one PNG with the plan, including the hour's shade when you have
drawn it. When a placed plant has a height, the elevation joins the same image.
With it come a plain-text plant list and a yard file that another phone can
open. Importing a yard file never overwrites a yard that phone already holds.

## Sun and shade

Give the sheet your latitude and a span in metres and the app computes the sun.
Each drawn bed reports its hours of direct light. The Ask tool reads the light
at any point you tap. Draw the shade washes the hour's shadow over the plan,
tree crowns and land included. Every answer uses the catalogue's own light
words, so one tap opens the guide filtered to plants for that spot, or saves it
as a spot. Without a latitude and a span the app computes no sun at all.

## The yard's year

The bloom wheel from the Kept list also sits over a yard's placed plants, with
gaps named. Under it, one line lists the blooming months with no recorded flower
visitor, and another the guild layers nobody has placed. Both are scoped to what
the data covers, so a missing record never counts as evidence.

Browse opens under a Today strip. It shows the season and which of your plants
are recorded in bloom now, with your own marks in your own colour.

`/annual` typesets a year of your record for the browser's print-to-PDF: blooms
you saw, notes, the wheel, every yard's sheet and your photos.

## Your own data

You are the fourth source. You can add notes, bloom dates you saw, your photo
where the guide has none, and a value for any field the sources left blank. Your
values filter, count, sort and draw like the record's. They always render in a
sepia "your ink" style and are never shown under a source's name.

Field notes exports everything you have written as one `.json` file that
restores completely on another phone. Next to it goes a plain-text copy that
will outlive the app. There is no account. Nothing you write leaves the browser
unless you export or share it.
