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
import { BLOOM_SLOTS, BLOOM_SEASONS, bloomSlots, periodsFor, slotForDate } from "./bloom";
import { archetypeOf, figurePaths, layerGapsOf, parseMetres, standing, stratumOf, tickStep, type Archetype } from "./elevation";
import { earthPathD, groundAt, groundRange, groundSkyline, parseLevel, sectionOf } from "./ground";
import { growthBand } from "./growth";
import { blockerOf, dayForSlot, directHours, lightTier, sunAt, sunlit, tierWord, type Terrain } from "./sun";
import { hardyIn, hardinessLabel, parseHardiness } from "./hardiness";
import { hardyBand } from "./homeZone";
import { indexMine } from "./mine";
import { outsideRecord, phenologyLine, visitorGaps } from "./phenology";
import { plantListText } from "./yardExport";
import { admitYard, parseYardFile, YARD_FORMAT } from "./yardFile";
import { ACCESS } from "./query";
import { decodeConstraints, encodeConstraints } from "./constraints";
import { seenSlots } from "./seen";
import { sanitizeSpot } from "./spots";
import { inBloomNow } from "./today";
import { labelRowsFor, scaleBarFor, sceneOf, shadeCells, SHADE_COLS, SHADE_ROWS } from "./yardViews";
import {
  commitStroke,
  MAX_GROUND,
  MAX_PTS,
  sanitizeYard,
  SHEET_H,
  SHEET_W,
  type GroundMark,
  type Yard,
} from "./yards";
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

test("asking a slot summons every period that covers it, and only those", () => {
  const late = periodsFor("Late Spring");
  assert.ok(late.includes("Late Spring") && late.includes("Spring") && late.includes("Indeterminate"),
    "the unqualified season and the continuous bloomers belong to the question");
  assert.ok(!late.includes("Early Summer"), "a period that misses the slot is not summoned");
  for (const slot of BLOOM_SLOTS)
    for (const p of periodsFor(slot))
      assert.ok(bloomSlots(p).includes(slot), `${p} must actually cover ${slot}`);
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

/* ---- the guild's shelves: her layer stacks, and silence stays silence --- */

test("a layer only she recorded shelves the plant in that guild section", () => {
  const p = { ...plant(null), id: 1, layer: null, functions: [] } as never as Plant;
  const hers = indexMine([mine(1, "layer", "shrubs")], {
    layer: [{ value: "Shrubs", count: 1 }],
  }).get(1);
  const asList = (v: readonly string[] | string | null): readonly string[] =>
    v === null ? [] : typeof v === "string" ? [v] : v;
  assert.equal(stratumOf(asList(ACCESS.layer(p, undefined)), []), null, "no record, no shelf");
  assert.equal(stratumOf(asList(ACCESS.layer(p, hers)), []), "Shrubs", "her answer shelves it");
});

test("the record's layer speaks first, and the ground-cover function stands in only for silence", () => {
  assert.equal(stratumOf(["Herbs", "Shrubs"], []), "Herbs");
  assert.equal(stratumOf([], ["Ground cover", "Dye"]), "Ground cover");
  assert.equal(stratumOf(["Herbs"], ["Ground cover"]), "Herbs", "a recorded layer is not overridden");
  assert.equal(stratumOf(["something odd"], []), null, "a value naming no stratum shelves nothing");
});

test("a missing layer and an unrecorded layer are two different silences", () => {
  const gaps = layerGapsOf([["Trees"], ["Herbs"], []]);
  assert.equal(gaps.unrecorded, 1, "the unrecorded plant is counted, not read as absence");
  assert.ok(!gaps.missing.includes("Trees") && !gaps.missing.includes("Herbs"));
  assert.ok(gaps.missing.includes("Roots"), "nobody carries Roots, and that is a real gap");
  assert.equal(layerGapsOf([]).missing.length, 7, "an empty yard is missing every stratum");
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

/* ---- the place asks the guide ----------------------------------------- */

// A derived light word must land in the bucket the sources already use, or
// applying it filters for a value no plant carries and quietly finds nothing.
test("a derived tier speaks the catalogue's own spelling, live values first", () => {
  const values = ["Full sun", "Partial sun/shade", "Full shade"];
  assert.equal(tierWord(values, "full"), "Full sun");
  assert.equal(tierWord(values, "part"), "Partial sun/shade");
  assert.equal(tierWord(values, "shade"), "Full shade");
  for (const tier of ["full", "part", "shade"] as const)
    assert.ok(values.includes(tierWord(values, tier)), `${tier} must be a value the facet carries`);
  // A differently-spelled catalogue still answers with its own words.
  assert.equal(tierWord(["full sun (6+ hours)", "part shade"], "full"), "full sun (6+ hours)");
  assert.equal(tierWord([], "part"), "Partial sun/shade", "the canonical fallback holds");
});

test("no latitude or no span computes no sun scene; nothing is guessed", () => {
  const yard = { v: 1, id: "y1", name: "y", at: 1, north: 0, strokes: [], plants: [] } as never;
  const spanned = { ...(yard as object), span: 20 } as never;
  assert.equal(sceneOf(yard, [], 43, null, null), null, "no span, no scene");
  assert.equal(sceneOf(spanned, [], null, null, null), null, "no latitude, no scene");
  const scene = sceneOf(spanned, [], 43, null, null);
  assert.ok(scene, "both numbers hers, the sun runs");
  assert.equal(scene!.lat, 43);
  assert.equal(scene!.upm, 50, "twenty metres across the 1000-unit sheet is 50 units per metre");
});

test("the shade wash draws only what the sun leaves, and never the night", () => {
  // The bank fixture from the sun rules, as a yard: 20m span, a bed pinned
  // level at (500,700) and a 5m bank just south of it. Winter noon at 40°N
  // never clears the bank, so the bed's cell is washed; a far corner with
  // nothing between it and the southern sun is not.
  const yard = {
    v: 1, id: "y", name: "y", at: 1, north: 0, strokes: [], plants: [],
    span: 20,
    ground: [mark(500, 700, 0), mark(300, 760, 5), mark(500, 760, 5), mark(700, 760, 5)],
  } as never;
  const scene = sceneOf(yard, [], 40, "Winter", null)!;
  const cells = shadeCells(scene, 0, 12)!;
  const at = (x: number, z: number) =>
    cells.shaded[
      Math.floor((z / SHEET_H) * SHADE_ROWS) * SHADE_COLS + Math.floor((x / SHEET_W) * SHADE_COLS)
    ];
  assert.equal(at(500, 700), 1, "behind the bank the wash falls");
  assert.equal(at(900, 1300), 0, "open ground keeps its sun");
  assert.ok(cells.litFrac > 0 && cells.litFrac < 1, "a bank shades some of the sheet, never all of it");
  assert.equal(shadeCells(scene, 0, 23), null, "night is not shade; nothing is washed");
});

test("crowded elevation names stagger onto a second row; spaced ones stay put", () => {
  const at = (uid: string, x: number) => ({ uid, x });
  const spaced = labelRowsFor([at("a", 100), at("b", 500), at("c", 900)]);
  assert.deepEqual([...spaced.values()], [0, 0, 0], "room enough needs no stagger");
  const crowd = labelRowsFor([at("a", 100), at("b", 180), at("c", 260), at("d", 900)]);
  assert.equal(crowd.get("a"), 0);
  assert.equal(crowd.get("b"), 1, "a name crowding its neighbour steps down");
  assert.equal(crowd.get("c"), 0, "and the chain alternates");
  assert.equal(crowd.get("d"), 0, "distance resets the row");
  // Order of the input never matters; only where the figures stand.
  const shuffled = labelRowsFor([at("c", 260), at("a", 100), at("b", 180)]);
  assert.deepEqual([shuffled.get("a"), shuffled.get("b"), shuffled.get("c")], [0, 1, 0]);
});

test("the scale bar is a round number of metres and stays a bar, not a banner", () => {
  assert.deepEqual(scaleBarFor(20), { m: 5, units: 250 });
  assert.deepEqual(scaleBarFor(10), { m: 2, units: 200 });
  for (const span of [2, 3, 8, 14, 30, 55, 120, 400, 2000]) {
    const { m, units } = scaleBarFor(span);
    const mant = m / 10 ** Math.floor(Math.log10(m) + 1e-9);
    assert.ok(
      [1, 2, 5].some((k) => Math.abs(mant - k) < 1e-9),
      `span ${span}: ${m} m is not a 1·2·5 length`,
    );
    assert.ok(units >= 100 && units <= 500, `span ${span}: ${units} units is not a readable bar`);
  }
});

test("an ask-derived light atom survives the URL round trip", () => {
  const c = {
    atoms: [{ kind: "facet", key: "light", value: "Partial sun/shade" } as const],
    text: "",
    view: "list" as const,
  };
  const back = decodeConstraints(encodeConstraints(c));
  assert.deepEqual(back.atoms, c.atoms, "the guide must open on exactly the asked condition");
});

/* ---- the ground: her heights become a surface, honestly ---------------- */

const mark = (x: number, y: number, m: number, id = `g${x}-${y}`): GroundMark => ({
  id,
  at: [x, y],
  m,
});

test("a ground height counts when it is a measurement and never when it is a sentence", () => {
  assert.equal(parseLevel("1.5"), 1.5);
  assert.equal(parseLevel("+2"), 2);
  assert.equal(parseLevel("-0.5"), -0.5);
  assert.equal(parseLevel("0"), 0, "a level pin is a real measurement");
  assert.equal(parseLevel("50 cm"), 0.5);
  assert.equal(parseLevel("1,5"), 1.5);
  assert.equal(parseLevel("3 ft"), 0.91);
  assert.equal(parseLevel("steep by the fence"), null);
  assert.equal(parseLevel("1000"), null, "past a cliff's worth it is a typo");
});

test("no marks claim flat: the ground is the sheet's own zero everywhere", () => {
  assert.equal(groundAt([], 500, 700), 0);
  assert.equal(groundAt(undefined, 10, 10), 0);
  assert.deepEqual(groundRange([]), { min: 0, max: 0 });
  assert.equal(sectionOf([], []).skyline, null);
});

test("the ground passes exactly through every height she set", () => {
  const marks = [mark(200, 300, 2), mark(800, 1100, -0.5), mark(500, 700, 0.75)];
  for (const g of marks) assert.equal(groundAt(marks, g.at[0], g.at[1]), g.m);
});

test("between her marks the ground stays between them, and never overshoots", () => {
  const marks = [mark(200, 300, 2), mark(800, 1100, -0.5)];
  for (let x = 0; x <= SHEET_W; x += 100) {
    for (let y = 0; y <= SHEET_H; y += 140) {
      const v = groundAt(marks, x, y);
      assert.ok(v <= 2 + 1e-9 && v >= -0.5 - 1e-9, `(${x},${y}) read ${v}`);
    }
  }
});

test("where she marked nothing the ground settles back to level", () => {
  const one = [mark(100, 100, 2)];
  const far = groundAt(one, 900, 1300);
  assert.ok(far < 0.5, `a lone mark must not float the far corner (${far})`);
  assert.ok(groundAt(one, 130, 100) > 1.8, "near the mark her number rules");
});

test("the skyline crests where the ground does, whatever depth the crest hides at", () => {
  const marks = [mark(500, 900, 3)];
  const sky = groundSkyline(marks, 100);
  assert.equal(Math.max(...sky), 3, "the mark's own crest shows side-on");
  assert.ok(sky[0] < 1, "the unmarked edge stays near level");
  const d = earthPathD(sky, 100, 520, 600);
  assert.ok(d.startsWith("M0 600") && d.endsWith("Z") && !d.includes("NaN"));
});

test("the section's scale fits the tallest reach and the deepest dip", () => {
  // A 2m crest, a 1m dip, and a plant reaching 4m above its footing.
  const marks = [mark(300, 300, 2), mark(700, 900, -1)];
  const s = sectionOf(marks, [4.6]);
  assert.ok(s.scale > 0);
  assert.ok(s.top * s.scale <= 520 - 36 + 1e-9, "the tallest reach stays on the page");
  assert.ok(-s.bottom * s.scale <= 600 - 520 - 44 + 1e-9, "the dip leaves room for its name");
  // With nothing standing and nothing shaped, there is nothing to scale.
  assert.equal(sectionOf([], []).scale, 0);
});

test("a yard admits only well-formed ground marks, capped, and old yards stay untouched", () => {
  const base = { v: 1, id: "y1", name: "home", at: 1, north: 0, strokes: [], plants: [] };
  const clean = sanitizeYard({
    ...base,
    ground: [
      mark(100, 100, 1.5),
      { id: "bad", at: [100], m: 1 },
      { id: "typo", at: [10, 10], m: 999 },
      { id: 7, at: [10, 10], m: 1 },
    ],
  });
  assert.deepEqual(clean?.ground, [mark(100, 100, 1.5, "g100-100")]);
  const many = sanitizeYard({
    ...base,
    ground: Array.from({ length: 80 }, (_, i) => mark(i, i, 1, `g${i}`)),
  });
  assert.equal(many?.ground?.length, MAX_GROUND);
  const flat = sanitizeYard(base);
  assert.ok(flat && !("ground" in flat), "a yard that never shaped its ground gains no key");
});

/* ---- her spots load shape-checked, like every other store -------------- */

// Spots was the one store that blind-cast its JSON: an entry with no `facets`
// loaded fine and then threw inside spotAtoms the first time she tapped it.
test("a spots list admits only well-formed entries and repairs what it can", () => {
  assert.deepEqual(
    sanitizeSpot({ id: "s1", name: "North bed", zone: 6, facets: { light: ["Full shade"] } }),
    { id: "s1", name: "North bed", zone: 6, facets: { light: ["Full shade"] } },
  );
  assert.equal(sanitizeSpot({ id: "s1", name: "no facets", zone: null }), null);
  assert.equal(sanitizeSpot({ id: "s1", name: "bad facets", zone: null, facets: 7 }), null);
  assert.equal(sanitizeSpot({ name: "no id", zone: null, facets: {} }), null);
  assert.deepEqual(
    sanitizeSpot({ id: "s2", name: "odd zone", zone: 99, facets: {} }),
    { id: "s2", name: "odd zone", zone: null, facets: {} },
    "a zone that is not a zone drops; the spot's site words survive",
  );
  assert.deepEqual(
    sanitizeSpot({ id: "s3", name: "mixed", zone: null, facets: { light: ["Full sun", 4] } }),
    { id: "s3", name: "mixed", zone: null, facets: { light: ["Full sun"] } },
    "a stray non-string value drops without costing the rest of the list",
  );
});

test("a bank between the winter sun and a bed shades it; the flat sheet does not", () => {
  // 20m span (50 units per metre), north up the sheet. A 5m bank just south
  // of a bed pinned level at zero; at 40N the winter sun never clears it.
  const upm = 50;
  const marks = [mark(500, 700, 0), mark(300, 760, 5), mark(500, 760, 5), mark(700, 760, 5)];
  const terrain: Terrain = {
    at: (x, z) => groundAt(marks, x, z) * upm,
    maxY: 5 * upm,
    w: SHEET_W,
    h: SHEET_H,
  };
  const winter = dayForSlot("Winter", 40);
  const flat = directHours(500, 700, 40, winter, 0, []);
  assert.ok(flat > 0, "the flat sheet sees some winter sun");
  assert.equal(directHours(500, 700, 40, winter, 0, [], terrain), 0, "behind the bank it sees none");
  // Open ground far from any mark keeps the sky it always had.
  const open = [mark(100, 100, 1)];
  const openTerrain: Terrain = {
    at: (x, z) => groundAt(open, x, z) * upm,
    maxY: 1 * upm,
    w: SHEET_W,
    h: SHEET_H,
  };
  assert.equal(
    directHours(900, 1300, 40, winter, 0, [], openTerrain),
    directHours(900, 1300, 40, winter, 0, []),
    "a far corner is not shaded by a distant molehill",
  );
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

/* ---- the handed list agrees with the handed drawing -------------------- */

// The exported sheet paints her values on the marks (tokens read through
// ACCESS), so the plant list underneath must carry them too — marked as
// hers, never as a source's, and never displacing what a source said.
test("her filled value reaches the handed list, marked as hers", () => {
  const yd = {
    v: 1, id: "y1", name: "y", at: 1, north: 0, strokes: [],
    plants: [{ uid: "u1", id: 1, name: "Plant", x: 1, y: 1 }],
  } as never;
  const p = {
    id: 1, name: "Plant", scientificName: "Plantus", functions: [],
    attracts: ["Bees"],
  } as never as Plant;
  const hers = indexMine(
    [mine(1, "bloomColor", "cream"), mine(1, "attracts", "bees, hoverflies")],
    FACETS_FIXTURE,
  );
  const txt = plantListText(yd, [p], hers);
  assert.ok(txt.includes("Bloom: cream (yours)"), "her colour travels, wearing her name");
  assert.ok(txt.includes("Visitors: Bees; Hoverflies (yours)"), "hers joins the source's, never displaces it");
  const bare = plantListText(yd, [p], new Map());
  assert.ok(bare.includes("Bloom: not in our sources"), "with nothing of hers the blank stays a blank");
});

// A client opens a plan on the phone that already holds their own gardens. The
// one rule this must never break is that the import cannot overwrite a yard she
// has; admitYard is where that lives, so it is pinned here.
const aYard = (id: string, name = "y"): Yard =>
  ({ v: 1, id, name, at: 1, north: 0, strokes: [], plants: [] }) as Yard;

test("an imported yard whose id collides is admitted fresh, never over hers", () => {
  const mine = [aYard("y1", "mine"), aYard("y2", "also mine")];
  const incoming = aYard("y1", "theirs");
  const out = admitYard(mine, incoming, "y-fresh");
  assert.equal(out.length, 3, "a collision must add, never replace");
  assert.deepEqual(out[0], mine[0], "her colliding yard is left byte-identical");
  assert.deepEqual(out[1], mine[1], "and the rest of hers untouched");
  assert.equal(out[2].id, "y-fresh", "the newcomer takes the fresh id");
  assert.equal(out[2].name, "theirs", "and keeps everything else it arrived with");
});

test("an imported yard with no collision keeps its own id", () => {
  const out = admitYard([aYard("y1")], aYard("y9", "new"), "y-fresh");
  assert.equal(out.length, 2);
  assert.equal(out[1].id, "y9", "no clash, no rename");
});

test("a yard file bounces garbage and admits a well-formed one", () => {
  assert.equal(parseYardFile("not json"), null);
  assert.equal(parseYardFile(JSON.stringify({ format: "something-else", v: 1 })), null);
  assert.equal(
    parseYardFile(JSON.stringify({ format: YARD_FORMAT, v: 1, yard: { name: "no id" } })),
    null,
    "a yard without an id is not a yard",
  );
  const good = JSON.stringify({
    format: YARD_FORMAT,
    v: 1,
    at: "2026-07-19",
    yard: aYard("y1", "Sunny bed"),
    photos: {},
  });
  const f = parseYardFile(good);
  assert.ok(f, "a well-formed file parses");
  assert.equal(f!.yard.name, "Sunny bed");
  assert.equal(f!.yard.id, "y1");
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

/* ---- today: the garden as it stands, recorded or hers, never guessed ---- */

test("in bloom now counts the printed band, her mark, and never silence", () => {
  const plants = [
    { id: 1, bloomPeriod: "Mid Summer" } as never as Plant, // the record's
    { id: 2 } as never as Plant, // her mark alone, below
    { id: 3 } as never as Plant, // neither: not "quiet", just unrecorded
  ];
  const seen = [{ id: 2, at: day(2026, 7, 14) }]; // Mid Summer, by her hand
  const { recorded, byHer } = inBloomNow(plants, seen, "Mid Summer");
  assert.deepEqual(recorded.map((p) => p.id), [1], "the band answers for USDA");
  assert.deepEqual(byHer.map((p) => p.id), [2], "her mark answers for her, in her ink");
  const winter = inBloomNow(plants, seen, "Winter");
  assert.equal(winter.recorded.length + winter.byHer.length, 0, "no record, no claim");
});

test("a plant both recorded and marked counts once, on the record's side", () => {
  const plants = [{ id: 1, bloomPeriod: "Fall" } as never as Plant];
  const seen = [{ id: 1, at: day(2026, 10, 2) }];
  const { recorded, byHer } = inBloomNow(plants, seen, "Fall");
  assert.equal(recorded.length, 1);
  assert.equal(byHer.length, 0, "two records of one fact must not read as two plants");
});

/* ---- the pollinator famine, coverage first ----------------------------- */

// A famine slot is one where something is recorded in bloom and none of the
// blooming plants has a recorded visitor. A slot where nothing blooms is the
// calendar's own verdict, not a second claim here; and a plant with neither
// band nor mark never counts as blooming anywhere.
const vplant = (id: number, period: string | null, attracts?: string[]) =>
  ({ id, bloomPeriod: period ?? undefined, attracts }) as never as Plant;

test("a famine slot needs bloom without any recorded visitor, and only that", () => {
  const plants = [
    vplant(1, "Late Spring", ["Bees"]),
    vplant(2, "Fall"), // blooms, no visitor recorded
    vplant(3, null), // no record, no marks: blooms nowhere here
  ];
  const vg = visitorGaps(plants, new Map(), []);
  assert.deepEqual(vg.gaps, ["Fall"], "spring is fed, fall is not, unbloomed slots claim nothing");
  assert.equal(vg.covered, 1);
  assert.equal(vg.of, 3);
});

test("her mark alone brings a plant's recorded visitors into a slot", () => {
  const plants = [vplant(1, null, ["Bees"]), vplant(2, "Winter")];
  const seen = [{ id: 1, at: day(2026, 1, 10) }]; // Winter, by her hand
  const vg = visitorGaps(plants, new Map(), seen);
  assert.deepEqual(vg.gaps, [], "her witnessed bloom feeds the slot the record left empty");
});

test("visitors recorded for nobody reads as coverage, never as a famine list", () => {
  const vg = visitorGaps([vplant(1, "Spring"), vplant(2, "Fall")], new Map(), []);
  assert.equal(vg.covered, 0, "the caller must print coverage alone on this answer");
  assert.ok(vg.gaps.length > 0, "the gaps exist but mean only 'no visitor data'");
});

test("her recorded visitors count through ACCESS like a source's", () => {
  const hers = indexMine([mine(2, "attracts", "hoverflies")], FACETS_FIXTURE);
  const plants = [vplant(1, "Late Spring", ["Bees"]), vplant(2, "Fall")];
  assert.deepEqual(visitorGaps(plants, new Map(), []).gaps, ["Fall"]);
  assert.deepEqual(visitorGaps(plants, hers, []).gaps, [], "her answer feeds the fall like any other");
});
