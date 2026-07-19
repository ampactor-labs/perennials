// The rules the guide turns on, pinned.
//
// Everything here was checked once by hand against the live 8,800 and then the
// script was thrown away, which is how "a lone hardiness number is a floor"
// stayed broken for months: nothing was watching. These are the invariants a
// future edit must not quietly cost us. Run with `npm test`. The modules
// under test are pure, so there is no DOM and no mocking here, only rules.
import { test } from "vitest";
import assert from "node:assert/strict";

import { mergeById, photoKeys } from "./backup";
import { BLOOM_SLOTS, BLOOM_SEASONS, bloomSlots, slotForDate } from "./bloom";
import { archetypeOf, figurePaths, parseMetres, standing, tickStep, type Archetype } from "./elevation";
import { growthBand } from "./growth";
import { blockerOf, dayForSlot, directHours, lightTier, sunAt, sunlit } from "./sun";
import { hardyIn, hardinessLabel, parseHardiness } from "./hardiness";
import { hardyBand } from "./homeZone";
import { indexMine } from "./mine";
import { outsideRecord, phenologyLine } from "./phenology";
import { ACCESS } from "./query";
import { seenSlots } from "./seen";
import { commitStroke, MAX_PTS, SHEET_H, SHEET_W } from "./yards";
import type { Plant } from "@/data/model";

const plant = (h: Plant["hardiness"]) => ({ hardiness: h }) as Plant;
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

/* ---- hardiness: the honesty rule, as arithmetic ---------------------- */

test("a lone recorded number is a floor, not a one-zone window", () => {
  // Chokecherry is recorded "1". It survives zone 6; the guide used to drop it.
  assert.equal(hardyIn({ min: 1, max: null }, 6), true);
  assert.equal(hardyIn({ min: 5, max: null }, 6), true);
  assert.equal(hardyIn({ min: 5, max: null }, 5), true);
  // ...but a floor is still a floor.
  assert.equal(hardyIn({ min: 5, max: null }, 4), false);
});

test("the degenerate min===max older data carries reads the same way", () => {
  assert.equal(hardyIn({ min: 1, max: 1 }, 6), true);
  assert.equal(hardyIn({ min: 8, max: 8 }, 6), false);
});

test("a recorded range is a claim and is honoured at both ends", () => {
  assert.equal(hardyIn({ min: 4, max: 7 }, 6), true);
  assert.equal(hardyIn({ min: 4, max: 7 }, 4), true);
  assert.equal(hardyIn({ min: 4, max: 7 }, 7), true);
  assert.equal(hardyIn({ min: 4, max: 7 }, 8), false);
  assert.equal(hardyIn({ min: 4, max: 7 }, 3), false);
});

test("the label never prints a fabricated top", () => {
  assert.equal(hardinessLabel({ min: 5, max: null }), "5+");
  assert.equal(hardinessLabel({ min: 5, max: 5 }), "5+");
  assert.equal(hardinessLabel({ min: 4, max: 7 }), "4–7");
});

/* ---- the sort: absence is never a demotion --------------------------- */

test("a plant we have no measurement for never ranks below one the record rules out", () => {
  const unmeasured = hardyBand(plant(null), 6);
  const misfit = hardyBand(plant({ min: 9, max: 11 }), 6);
  const fits = hardyBand(plant({ min: 4, max: 7 }), 6);
  assert.equal(unmeasured, 1);
  assert.equal(misfit, 2);
  assert.equal(fits, 0);
  assert.ok(fits < unmeasured && unmeasured < misfit, "bands must order fit < unrecorded < misfit");
});

test("a floor-only record bands as fit, not as a misfit", () => {
  assert.equal(hardyBand(plant({ min: 1, max: null }), 6), 0);
  assert.equal(hardyBand(plant({ min: 1, max: 1 }), 6), 0);
});

/* ---- the bloom axis -------------------------------------------------- */

test("the season headers span exactly the nine slots", () => {
  assert.equal(BLOOM_SEASONS.reduce((a, s) => a + s.span, 0), BLOOM_SLOTS.length);
  assert.equal(BLOOM_SLOTS.length, 9);
});

test("every month lands on a slot, and every slot is reachable", () => {
  const hit = new Set<string>();
  for (let m = 1; m <= 12; m++) {
    const s = slotForDate(day(2026, m, 15));
    assert.ok(BLOOM_SLOTS.includes(s), `month ${m} -> ${s}`);
    hit.add(s);
  }
  assert.equal(hit.size, BLOOM_SLOTS.length, "some slot is unreachable from the calendar");
});

test("a month never straddles two slots", () => {
  for (let m = 1; m <= 12; m++) {
    assert.equal(slotForDate(day(2026, m, 1)), slotForDate(day(2026, m, 28)), `month ${m} splits`);
  }
});

test("an unrecorded period covers no slots, which is not 'does not flower'", () => {
  assert.deepEqual(bloomSlots(null), []);
  assert.deepEqual(bloomSlots(undefined), []);
  assert.deepEqual(bloomSlots(""), []);
  assert.deepEqual(bloomSlots("Nonsense"), []);
});

test("an unqualified season covers its whole band, never a picked slot", () => {
  assert.deepEqual(bloomSlots("Spring"), ["Early Spring", "Mid Spring", "Late Spring"]);
  assert.deepEqual(bloomSlots("Late Spring"), ["Late Spring"]);
  // Blooms continuously is the datum, not a guess: it is in flower in every slot.
  assert.deepEqual(bloomSlots("Indeterminate"), [...BLOOM_SLOTS]);
});

/* ---- her marks ------------------------------------------------------- */

test("her marks coarsen onto the axis, dedupe, and read in the year's order", () => {
  const seen = [
    { id: 7, at: day(2026, 7, 20) }, // Mid Summer
    { id: 7, at: day(2026, 7, 3) },  // Mid Summer again
    { id: 7, at: day(2026, 4, 9) },  // Mid Spring
    { id: 7, at: day(2026, 10, 1) }, // Fall
    { id: 8, at: day(2026, 1, 5) },  // another plant entirely
  ];
  assert.deepEqual(seenSlots(seen, 7), ["Mid Spring", "Mid Summer", "Fall"]);
  assert.deepEqual(seenSlots(seen, 99), []);
});

/* ---- the sketch stays bounded ---------------------------------------- */

test("a wandering thumb cannot grow a stroke past the cap", () => {
  const wild: [number, number][] = Array.from({ length: 2000 }, (_, i) => [
    500 + 400 * Math.sin(i / 7) + (i % 13),
    i * 0.7 + (i % 11),
  ]);
  const out = commitStroke(wild);
  assert.ok(out.length <= MAX_PTS, `${out.length} points survived a ${MAX_PTS} cap`);
  assert.ok(out.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)), "coords must be integers");
  assert.deepEqual(out[0], [Math.round(wild[0][0]), Math.round(wild[0][1])], "the stroke must keep where it started");
});

test("a straight line keeps its two ends and nothing else", () => {
  const line: [number, number][] = Array.from({ length: 100 }, (_, i) => [i * 10, i * 10]);
  assert.equal(commitStroke(line).length, 2);
});

test("the sheet is portrait and dimensionless", () => {
  assert.ok(SHEET_H > SHEET_W, "the sheet she holds is portrait");
});

/* ---- her values reach the guide, and never wear a source's name ------- */

const FACETS_FIXTURE = {
  bloomColor: [{ value: "Purple", count: 1 }, { value: "Yellow", count: 1 }],
  attracts: [{ value: "Bees", count: 1 }, { value: "Hoverflies", count: 1 }],
  light: [{ value: "Full sun", count: 1 }],
};

const mine = (id: number, field: string, text: string) => ({ id, field, text, at: 1 }) as never;

test("her spelling joins the catalogue's, instead of forking the rail", () => {
  const ix = indexMine([mine(1, "bloomColor", "purple")], FACETS_FIXTURE);
  assert.deepEqual(
    ix.get(1)!.facets.bloomColor,
    ["Purple"],
    "'purple' and 'Purple' are one answer; two options that mean one thing is the bug",
  );
});

test("a value the sources never heard of survives as she typed it", () => {
  const ix = indexMine([mine(1, "bloomColor", "cream")], FACETS_FIXTURE);
  assert.deepEqual(ix.get(1)!.facets.bloomColor, ["cream"], "cream is not a USDA colour and is still true");
});

test("a list she typed is a list, not one long answer", () => {
  const ix = indexMine([mine(1, "attracts", "bees, Hoverflies")], FACETS_FIXTURE);
  assert.deepEqual(ix.get(1)!.facets.attracts, ["Bees", "Hoverflies"]);
});

test("her value filters, counts and covers exactly like a source's", () => {
  const p = { ...plant(null), id: 1, bloomColor: undefined } as Plant;
  const hers = indexMine([mine(1, "bloomColor", "purple")], FACETS_FIXTURE).get(1);
  assert.equal(ACCESS.bloomColor(p, undefined), null, "with nothing of hers it is still a blank");
  assert.deepEqual(ACCESS.bloomColor(p, hers), ["Purple"], "with her value the guide can see it");
});

test("a plant she has not touched costs nothing to read", () => {
  const p = { ...plant(null), id: 1, light: ["Full sun"] } as Plant;
  assert.equal(
    ACCESS.light(p, undefined),
    p.light,
    "the source's own array must come back by reference, not copied per plant per facet",
  );
});

test("her answer never overwrites a source's, only joins it", () => {
  const p = { ...plant(null), id: 1, functions: ["Nitrogen fixer"] } as Plant;
  const hers = indexMine([mine(1, "functions", "Chop and drop")], { functions: [] }).get(1);
  assert.deepEqual(ACCESS.functions(p, hers), ["Nitrogen fixer", "Chop and drop"]);
});

test("saying what the source already says does not say it twice", () => {
  const p = { ...plant(null), id: 1, functions: ["Nitrogen fixer"] } as Plant;
  const hers = indexMine([mine(1, "functions", "nitrogen fixer")], {
    functions: [{ value: "Nitrogen fixer", count: 1 }],
  }).get(1);
  assert.deepEqual(ACCESS.functions(p, hers), ["Nitrogen fixer"]);
});

// A zone drives the sort and the filter, so a guess here moves her plants for a
// reason she never gave. Only what parses as a zone is allowed to.
test("her hardiness counts when it is a zone and never when it is a sentence", () => {
  assert.deepEqual(parseHardiness("5"), { min: 5, max: null }, "a lone number is a floor, as the record's is");
  assert.deepEqual(parseHardiness("zone 5"), { min: 5, max: null });
  assert.deepEqual(parseHardiness("5-9"), { min: 5, max: 9 });
  assert.deepEqual(parseHardiness("5+"), { min: 5, max: null });
  assert.equal(parseHardiness("hardy-ish by the south wall"), null, "a sentence is not a measurement");
  assert.equal(parseHardiness("99"), null, "there is no zone 99");
  assert.equal(parseHardiness("9-5"), null, "a range that runs backwards is not a range");
});

test("her zone moves a plant out of the band for plants we cannot place", () => {
  const p = { ...plant(null), id: 1 } as Plant;
  const hers = indexMine([mine(1, "hardiness", "4")], {}).get(1);
  assert.equal(hardyBand(p, 6, undefined), 1, "with no number it is paperwork, not a verdict");
  assert.equal(hardyBand(p, 6, hers), 0, "she measured it; it is hardy here and sorts like it");
  assert.equal(hardyBand(p, 2, hers), 2, "and where her own number rules it out, it sorts like that too");
});

test("an unparseable hardiness leaves the plant where it was", () => {
  const p = { ...plant(null), id: 1 } as Plant;
  const hers = indexMine([mine(1, "hardiness", "dies in a hard frost")], {}).get(1);
  assert.equal(hardyBand(p, 6, hers), 1, "her words stay on the page and out of the sort");
});

/* ---- the elevation: size is a claim, so only measurements make one ----- */

test("her height counts when it is a measurement and never when it is a sentence", () => {
  assert.equal(parseMetres("2"), 2, "a bare number is metres, as the record prints them");
  assert.equal(parseMetres("2.5 m"), 2.5);
  assert.equal(parseMetres("2,5"), 2.5);
  assert.equal(parseMetres("250 cm"), 2.5);
  assert.equal(parseMetres("6 ft"), 1.83, "feet are arithmetic, not invention");
  assert.equal(parseMetres("8'"), 2.44);
  assert.equal(parseMetres("taller than the shed"), null, "a sentence is not a measurement");
  assert.equal(parseMetres("0"), null);
  assert.equal(parseMetres("1800"), null, "no plant is 1.8km tall; a typo must not flatten the scale");
});

test("the record's height is never overwritten, and absence never invents one", () => {
  assert.deepEqual(standing(12, "3"), { m: 12, hers: false }, "her value fills silence, it does not overwrite");
  assert.deepEqual(standing(null, "3"), { m: 3, hers: true });
  assert.equal(standing(null, "waist high"), null, "her words stay on the page and off the scale");
  assert.equal(standing(null, undefined), null);
  assert.equal(standing(0, undefined), null, "a recorded zero is a gap, not a measurement");
});

test("every guild layer has a figure, and no plant wears one its record lacks", () => {
  for (const l of ["Tall trees", "Trees", "Shrubs", "Vines", "Herbs", "Ground cover", "Roots"])
    assert.notEqual(archetypeOf(l), "plain", `${l} must have a shape of its own`);
  assert.equal(archetypeOf(null), "plain");
  assert.equal(archetypeOf("Nonsense"), "plain", "an unrecorded layer is the plain column, never a tree's crown");
});

// One geometry serves the screen and the exported sheet, so the figure a
// client is handed is the figure she saw; this pins that every archetype
// actually draws, and that only the layers which reach beyond the fill do.
test("every archetype draws, and only trees carry trunks, only roots reach down", () => {
  const kinds: Archetype[] = ["tall-tree", "tree", "shrub", "vine", "herb", "ground", "root", "plain"];
  for (const k of kinds) {
    const fig = figurePaths(k, 500, 520, 100, 60);
    assert.ok(fig.body.length > 0 && !fig.body.includes("NaN"), `${k} must draw a clean body`);
    assert.equal(fig.trunk !== undefined, k === "tall-tree" || k === "tree", `${k}: trunk`);
    assert.equal(fig.taproot !== undefined, k === "root", `${k}: taproot`);
  }
});

test("the height rule stays readable at any yard's scale", () => {
  assert.equal(tickStep(1.2), 0.25);
  assert.equal(tickStep(3), 0.5);
  assert.equal(tickStep(6), 1);
  assert.equal(tickStep(10), 2);
  assert.equal(tickStep(25), 5);
  assert.equal(tickStep(80), 10);
  for (const m of [0.4, 1.5, 4, 9, 28, 120])
    assert.ok(Math.floor(m / tickStep(m)) <= 13, `${m}m must not print a wall of ticks`);
});

/* ---- the sun: computed like the sky, never guessed --------------------- */

test("the computed sun behaves like the sky", () => {
  // Equinox noon at latitude 40: altitude 90 - 40, sun due south.
  const eq = sunAt(40, 80, 12);
  assert.ok(Math.abs(eq.altitude - 50) < 1.5, `equinox noon altitude ${eq.altitude}`);
  assert.ok(Math.abs(eq.azimuth - 180) < 3, `equinox noon azimuth ${eq.azimuth}`);
  // Summer noon stands higher than winter noon, and both are daylight.
  const summer = sunAt(40, 172, 12).altitude;
  const winter = sunAt(40, 355, 12).altitude;
  assert.ok(summer > winter + 40, "the seasons must move the sun");
  // South of the equator the noon sun hangs north.
  const south = sunAt(-35, 355, 12).azimuth;
  assert.ok(south < 10 || south > 350, `southern noon azimuth ${south}`);
});

test("a season word falls on opposite days across the equator", () => {
  assert.notEqual(dayForSlot("Mid Summer", 40), dayForSlot("Mid Summer", -35));
});

test("a crown shades near ground, spares far ground, and shades farther in winter", () => {
  // An 8m tree on a sheet spanning 100m (10 units per metre), north up.
  const tree = [blockerOf("tree", 500, 500, 8, 6, 10)];
  const noonSummer = sunAt(40, 172, 12);
  const noonWinter = sunAt(40, 355, 12);
  assert.equal(sunlit(500, 485, noonSummer, 0, tree), false, "just north of the tree is shade");
  assert.equal(sunlit(500, 100, noonSummer, 0, tree), true, "forty metres out is open sun");
  assert.equal(sunlit(500, 420, noonSummer, 0, tree), true, "the high sun clears eight metres");
  assert.equal(sunlit(500, 420, noonWinter, 0, tree), false, "the low sun does not");
  assert.equal(sunlit(500, 500, noonSummer, 0, tree), false, "under the crown is shade");
});

test("open ground reads full sun; a June day at 40N carries it easily", () => {
  const hours = directHours(500, 700, 40, 166, 0, []);
  assert.ok(hours >= 10, `open June ground got ${hours}h`);
  assert.equal(lightTier(hours), "full");
  assert.equal(lightTier(5.5), "part");
  assert.equal(lightTier(3), "part");
  assert.equal(lightTier(2.5), "shade");
});

/* ---- growth: a pace in three words is a band, not a curve -------------- */

test("a recorded pace grows monotonically toward mature and never past it", () => {
  for (const word of ["Slow", "Moderate", "Fast"]) {
    let last = 0;
    for (const y of [0, 2, 5, 10, 20, 40]) {
      const b = growthBand(word, y);
      assert.ok(b, `${word} must band`);
      assert.ok(b.lo <= b.hi, "the cautious reading never outruns the generous one");
      assert.ok(b.hi <= 1.000001, "nothing grows past its recorded mature height");
      assert.ok(b.hi >= last, "growth does not run backwards");
      last = b.hi;
    }
  }
  const fast = growthBand("Fast", 7)!;
  assert.ok(fast.hi >= 0.9, "fast at seven years is nearly grown");
  assert.ok(growthBand("Fast", 5)!.hi > growthBand("Slow", 5)!.hi, "fast outpaces slow");
});

test("an unrecorded pace bands nothing; the caller says the gap instead", () => {
  assert.equal(growthBand(null, 5), null);
  assert.equal(growthBand(undefined, 5), null);
  assert.equal(growthBand("vigorous, they say", 5), null);
  assert.deepEqual(growthBand("Fast", 0), { lo: 0, hi: 0 }, "the year it goes in, it is a sapling");
});

/* ---- the backup carries every photo her stores point at ---------------- */

// A key exported without its image, or an image left behind by the export, is
// an import that looks fine and shows a hole. Two stores hold keys now (her
// plant photos, the ground under a yard), so the collection is one pure
// function and this rule watches it.
test("the backup collects her plant photos and every yard's ground, once each", () => {
  const hers = [mine(1, "photo", "pA"), mine(2, "bloomColor", "cream")];
  const yards = [
    { id: "y1", underlay: "pB" },
    { id: "y2" },
    { id: "y3", underlay: "pA" },
  ] as never[];
  assert.deepEqual(
    photoKeys(hers, yards).sort(),
    ["pA", "pB"],
    "her typed values carry no blob, a yard without a ground adds nothing, and a key two stores share rides once",
  );
});

/* ---- the restore: a merge never costs her an entry -------------------- */

// The realistic restore is her second device, so the merge is the one piece of
// this app that can silently delete work she cannot get back. Every rule it
// relies on is pinned here.

type E = { k: string; at: number; v: string };
const id = (e: E) => e.k;
const at = (e: E) => e.at;

test("a merge keeps every entry only one side has", () => {
  const here: E[] = [{ k: "a", at: 1, v: "here" }];
  const file: E[] = [{ k: "b", at: 1, v: "file" }];
  const out = mergeById(here, file, id, at, "merge");
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((e) => e.k).sort(),
    ["a", "b"],
    "a merge is a union; neither side may lose an entry the other lacks",
  );
});

test("a merge takes the newer of two entries for the same thing", () => {
  const here: E[] = [{ k: "a", at: 10, v: "newer" }];
  const file: E[] = [{ k: "a", at: 2, v: "older" }];
  assert.equal(mergeById(here, file, id, at, "merge")[0].v, "newer", "an old backup must not undo newer work");
  assert.equal(mergeById(file, here, id, at, "merge")[0].v, "newer", "and the same, whichever side it arrives on");
});

test("a merge cannot shrink the phone's own list", () => {
  const here: E[] = [
    { k: "a", at: 5, v: "a" },
    { k: "b", at: 5, v: "b" },
    { k: "c", at: 5, v: "c" },
  ];
  const out = mergeById(here, [{ k: "a", at: 99, v: "newer a" }], id, at, "merge");
  assert.ok(out.length >= here.length, "a restore that drops her entries is the bug this rules out");
});

test("replace is the only mode that discards what's on the phone", () => {
  const here: E[] = [{ k: "a", at: 1, v: "hers" }];
  const file: E[] = [{ k: "b", at: 1, v: "theirs" }];
  assert.deepEqual(mergeById(here, file, id, at, "replace"), file, "replace means replace, and says so");
});

test("an empty backup merged in changes nothing", () => {
  const here: E[] = [{ k: "a", at: 1, v: "hers" }];
  assert.deepEqual(mergeById(here, [], id, at, "merge"), here, "importing an empty file is not a delete");
});

/* ---- her dates against the record ------------------------------------ */

// She saw it; USDA averaged it. When her marks fall outside the printed band
// the guide says so, and when they fall inside it there is nothing to say.
// Divergence needs both sides: a missing period is a gap in our data, not a
// band she can fall outside of, so it can never put words in USDA's mouth.

test("marks inside the printed band claim nothing", () => {
  assert.equal(phenologyLine(["Late Spring"], "Late Spring"), null);
  assert.equal(phenologyLine(["Early Summer", "Late Summer"], "Summer"), null);
  // Blooms continuously covers every slot, so nothing of hers can outrun it.
  assert.equal(phenologyLine(["Winter"], "Indeterminate"), null);
});

test("a mark before the band names exactly the out-of-record slots, in the year's order", () => {
  assert.deepEqual(
    outsideRecord(["Mid Spring", "Late Spring"], ["Late Spring"]),
    ["Mid Spring"],
    "a mark the band already covers must not be repeated as a divergence",
  );
  assert.deepEqual(
    outsideRecord(["Fall", "Winter"], ["Mid Summer"]),
    ["Winter", "Fall"],
    "the sentence runs the way a year does, whatever order her marks arrive in",
  );
  assert.equal(
    phenologyLine(["Mid Spring"], "Late Spring"),
    "You saw it bloom in Mid Spring; USDA's record says Late Spring.",
    "her sighting is a fact, the period is USDA's by name, and neither is called wrong",
  );
  assert.equal(
    phenologyLine(["Winter", "Fall"], "Mid Summer"),
    "You saw it bloom in Winter and Fall; USDA's record says Mid Summer.",
  );
});

test("no recorded period claims nothing, whatever she marked", () => {
  assert.equal(phenologyLine(["Mid Spring"], null), null);
  assert.equal(phenologyLine(["Mid Spring"], undefined), null);
  assert.equal(phenologyLine(["Mid Spring"], ""), null);
  assert.equal(phenologyLine(["Mid Spring"], "Nonsense"), null, "a period we cannot read is not a band either");
});

test("no marks claim nothing", () => {
  assert.equal(phenologyLine([], "Late Spring"), null, "nothing witnessed is nothing to say");
  assert.deepEqual(outsideRecord([], ["Late Spring"]), []);
});
