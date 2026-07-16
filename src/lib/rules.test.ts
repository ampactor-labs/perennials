// The rules the guide turns on, pinned.
//
// Everything here was checked once by hand against the live 8,800 and then the
// script was thrown away, which is how "a lone hardiness number is a floor"
// stayed broken for months: nothing was watching. These are the invariants a
// future edit must not quietly cost us. Run with `npm test`. The modules
// under test are pure, so there is no DOM and no mocking here, only rules.
import { test } from "vitest";
import assert from "node:assert/strict";

import { BLOOM_SLOTS, BLOOM_SEASONS, bloomSlots, slotForDate } from "./bloom";
import { hardyIn, hardinessLabel } from "./hardiness";
import { hardyBand } from "./homeZone";
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

test("a plant nobody measured never ranks below one the record rules out", () => {
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
