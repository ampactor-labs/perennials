import type { Hardiness, Plant } from "@/data/model";
import type { Dataset } from "@/data/store";
import { atomLabel, facetsOf, zoneOf, type Atom, type Constraints } from "./constraints";
import { hardyIn } from "./hardiness";

/**
 * How each facet reads off a plant, and off her.
 *
 * A single-valued field returns the bare string, not a one-element array. Wrapping
 * them uniformly was tidier to read and cost an allocation per plant per facet:
 * 123,000 throwaway arrays on every evaluation, straight into the garbage
 * collector, on a phone. The three helpers below absorb the difference.
 *
 * This is the one place the guide asks what a plant is, so it is the one place
 * her answers have to arrive. Everything downstream reads through here: what
 * survives a filter, what the rail offers and what it counts, what coverage
 * reports, what the suggestions promise. Fold her in here and all of it follows;
 * fold her in anywhere else and the rest of the list silently doesn't.
 *
 * `hers` is looked up once per plant by the caller, not once per facet, and is
 * undefined for every plant she has never written on, which is very nearly all of
 * them. `both` returns the source's value untouched on that path, so the cost of
 * her existing is one map lookup per plant and no allocation at all.
 */
type Value = readonly string[] | string | null;

/**
 * Her side of one plant: the facet values she wrote, in the catalogue's spelling,
 * and her zone if what she typed was one.
 *
 * Structural on purpose. This module asks what a plant is; it has no business
 * knowing where her answers are kept, and lib/mine.ts's Hers satisfies this
 * without either file importing the other.
 */
type Hers = { facets: Record<string, string[]>; hardiness: Hardiness | null };
type MineIndex = ReadonlyMap<number, Hers>;

/**
 * The source's value and hers, together.
 *
 * They coexist on `functions` by design and nowhere else, because the "+" only
 * appears where the sources gave nothing. Duplicates are dropped anyway: her
 * value is canonicalized to the catalogue's spelling before it gets here, so
 * "Nitrogen fixer" said twice is one answer, not two.
 */
const both = (v: Value, hers: string[] | undefined): Value => {
  if (hers === undefined) return v;
  if (v === null) return hers;
  const base = typeof v === "string" ? [v] : v;
  const out = base.slice();
  for (const h of hers) if (!out.includes(h)) out.push(h);
  return out;
};

export const ACCESS: Record<string, (p: Plant, hers?: Hers) => Value> = {
  layer: (p, h) => both(p.layer, h?.facets.layer),
  light: (p, h) => both(p.light, h?.facets.light),
  water: (p, h) => both(p.water, h?.facets.water),
  soil: (p, h) => both(p.soil, h?.facets.soil),
  lifeCycle: (p, h) => both(p.lifeCycle, h?.facets.lifeCycle),
  growth: (p, h) => both(p.growth, h?.facets.growth),
  edibleParts: (p, h) => both(p.edibleParts, h?.facets.edibleParts),
  functions: (p, h) => both(p.functions, h?.facets.functions),
  attracts: (p, h) => both(p.attracts ?? null, h?.facets.attracts),
  bloomColor: (p, h) => both(p.bloomColor ?? null, h?.facets.bloomColor),
  // Not hers to fill: her bloom record is the dates she stamps in her own yard,
  // which the calendar draws. See MINE_FIELDS.
  bloomPeriod: (p) => p.bloomPeriod ?? null,
  warnings: (p) => p.warnings,
  family: (p) => p.family,
  nativeTo: (p, h) => both(p.nativeTo, h?.facets.nativeTo),
};

const holds = (v: Value, want: string): boolean =>
  v === null ? false : typeof v === "string" ? v === want : v.includes(want);

const isEmpty = (v: Value): boolean => v === null || (typeof v !== "string" && v.length === 0);

function tally(m: Map<string, number>, v: Value): void {
  if (v === null) return;
  if (typeof v === "string") {
    m.set(v, (m.get(v) ?? 0) + 1);
    return;
  }
  for (const x of v) m.set(x, (m.get(x) ?? 0) + 1);
}

export type FacetMeta = {
  key: string;
  label: string;
  searchable: boolean;
  /** Site facets describe a place; intent facets describe what you want.
   *  Caution facets describe what to watch for; they are not an ask. */
  group: "site" | "intent" | "caution";
  note?: string;
  /**
   * Show how much of the catalog this field was actually recorded for.
   *
   * A plant with no value is excluded by facetOk, so filtering "Bloom period:
   * Early Summer" answers "plants USDA wrote a bloom period for", not "plants
   * that bloom in early summer", and the trail prints the difference as if it
   * were a fact about plants. Where coverage is partial, say so.
   */
  coverage?: boolean;
};

// Site first (the conditions she has), then intent, the things she wants.
export const FACETS: FacetMeta[] = [
  { key: "light", label: "Light", searchable: false, group: "site" },
  { key: "water", label: "Water", searchable: false, group: "site" },
  { key: "soil", label: "Soil", searchable: false, group: "site" },
  { key: "layer", label: "Layer", searchable: false, group: "intent", coverage: true },
  { key: "lifeCycle", label: "Life cycle", searchable: false, group: "intent", coverage: true },
  { key: "growth", label: "Growth rate", searchable: false, group: "intent", coverage: true },
  { key: "bloomColor", label: "Bloom colour", searchable: false, group: "intent", note: "Flower colour, as USDA PLANTS records it. USDA is a North-American database, so it knows the plants you would actually put in the ground and not much else.", coverage: true },
  { key: "bloomPeriod", label: "Bloom period", searchable: false, group: "intent", note: "When USDA PLANTS records it flowering. Same North-American bias as the colour.", coverage: true },
  { key: "edibleParts", label: "Edible parts", searchable: false, group: "intent" },
  { key: "functions", label: "Function & use", searchable: true, group: "intent", note: "What the plant is for. Food, fibre, nitrogen, dye.", coverage: true },
  { key: "attracts", label: "Attracts", searchable: false, group: "intent", note: "Who has actually been seen at the flowers. These are published field observations from GloBI, not a gardening book's opinion about what bees like.", coverage: true },
  { key: "family", label: "Family", searchable: true, group: "intent" },
  { key: "nativeTo", label: "Native to", searchable: true, group: "intent", note: "Where it grows wild." },
  // Not an ask. Selecting "Toxic" finds toxic plants; it does not avoid them, and
  // filing it under "what you want" said the opposite of what she means by it.
  { key: "warnings", label: "Cautions", searchable: false, group: "caution", note: "Only what a contributor thought to flag. A blank only means nobody thought to flag it." },
];

/** The key coverageOf reports hardiness under. Not a facet; it has its own control. */
export const ZONE_COVERAGE = "hardiness";

/** How many plants have any value at all for each facet, hers counted. */
export function coverageOf(plants: Plant[], mine: MineIndex): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of FACETS) {
    if (!f.coverage) continue;
    let n = 0;
    for (const p of plants) if (!isEmpty(ACCESS[f.key](p, mine.get(p.id)))) n += 1;
    out[f.key] = n;
  }
  // Hardiness is the constraint she trusts most and the one whose absence is
  // least visible. zoneOk excludes a plant with no record exactly as it excludes
  // one that would die there, so "hardy in zone 6, 3,730 plants" reads as a claim
  // about survival when 2,788 of the exclusions are a claim about paperwork.
  let known = 0;
  for (const p of plants) if (p.hardiness ?? mine.get(p.id)?.hardiness) known += 1;
  out[ZONE_COVERAGE] = known;
  return out;
}

const zoneOk = (p: Plant, zone: number | null, hers?: Hers) => {
  if (zone === null) return true;
  const h = p.hardiness ?? hers?.hardiness ?? null;
  return !!h && hardyIn(h, zone);
};

function facetOk(p: Plant, key: string, selected: string[], hers?: Hers): boolean {
  if (selected.length === 0) return true;
  const have = ACCESS[key](p, hers);
  return selected.some((v) => holds(have, v));
}

function atomsState(atoms: Atom[]) {
  const facets: Record<string, string[]> = {};
  let zone: number | null = null;
  let edible = false;
  for (const a of atoms) {
    if (a.kind === "facet") (facets[a.key] ??= []).push(a.value);
    else if (a.kind === "zone") zone = a.zone;
    else edible = true;
  }
  return { facets, zone, edible };
}

export type TrailStep = {
  /** The atoms merged into this step. Empty for the free-text step. */
  atoms: Atom[];
  /** Facet name, e.g. "Water". Empty for text and Edible. */
  key: string;
  label: string;
  count: number;
};

export type Evaluation = {
  results: Plant[];
  counts: Record<string, Map<string, number>>;
  /** Cumulative counts as each constraint applies, for the collapse trail. */
  trail: TrailStep[];
  /**
   * How much of what she is actually looking at has a value for each facet.
   *
   * Catalogue-wide coverage is a number about the world and it misleads badly.
   * USDA records a bloom colour for 1,038 of 8,800 plants, which reads as 12% and
   * sounds useless. But USDA is a North-American database, and once she has said
   * "hardy in zone 6" and "native to North America" the same field covers 202 of
   * 496, which is 41%. Report the number about her search, not the number about
   * 8,800 global taxa she will never plant.
   */
  coverage: Record<string, { covered: number; of: number }>;
};

// Pseudo-keys, so zone and edible can sit in the same failure bookkeeping as
// facets without colliding with a real facet name.
const ZONE_KEY = " zone";
const EDIBLE_KEY = " edible";

/**
 * The atoms grouped by what they constrain, in the order she first touched each.
 *
 * Grouping is not cosmetic. Within a facet the test is OR, so picking a second
 * Light value *widens* the set, and listing the two as separate trail steps
 * produced a collapse trail whose numbers went up (8,800 → Full sun 8,070 →
 * Full shade 8,305). A step that widens is not a step in a narrowing. One step
 * per facet, showing the union, and the trail is monotone again.
 */
function stepsOf(atoms: Atom[]) {
  const steps: { key: string; atoms: Atom[] }[] = [];
  const index = new Map<string, number>();
  for (const a of atoms) {
    const key = a.kind === "facet" ? a.key : a.kind === "zone" ? ZONE_KEY : EDIBLE_KEY;
    let i = index.get(key);
    if (i === undefined) {
      i = steps.length;
      index.set(key, i);
      steps.push({ key, atoms: [] });
    }
    steps[i].atoms.push(a);
  }
  return { steps, index };
}

/**
 * The index's hits, then the plants she said it about.
 *
 * Her words are not in MiniSearch and must not be. The index takes an 8,800
 * document pass and is built once per payload and never on a re-sort (see
 * makeIndexBuilder); rebuilding it every time she fills in a blank would hand her
 * back the half second of frozen phone that whole design exists to avoid, and
 * hand it back at the moment she is typing.
 *
 * It does not need to. Her records are one gardener's annotations, tens of them,
 * not 8,800, so a substring scan over her own writing costs nothing. Type "cream"
 * and the plant she called cream comes back, though USDA never described it.
 *
 * Hers land after the index's ranking rather than inside it. Relevance is the
 * index's judgement and this has no way to score against it, so appending keeps
 * that order exactly as it was and adds what it could not have known.
 */
function withHerWords(data: Dataset, text: string): string[] {
  const ranked = data.index.search(text).map((r) => r.slug as string);
  if (data.mine.size === 0) return ranked;
  const needle = text.trim().toLowerCase();
  const seen = new Set(ranked);
  for (const [id, hers] of data.mine) {
    if (!hers.text.includes(needle)) continue;
    const p = data.byId.get(id);
    if (p && !seen.has(p.slug)) {
      ranked.push(p.slug);
      seen.add(p.slug);
    }
  }
  return ranked;
}

/**
 * One evaluation produces the results, the per-facet option counts holding every
 * other constraint fixed, and the collapse trail, in a single pass over the data.
 *
 * It used to take fourteen-plus passes: one per facet to build its counts, then
 * one more per atom for the trail, which came to ~176,000 whole-plant tests on
 * every tap and cost her a fifth of a second of dead main thread on a phone.
 *
 * The one-pass form falls out of a small observation. For each plant, collect the
 * set of constraints it fails. It belongs in the results when that set is empty,
 * and it counts toward facet F's options exactly when the only thing it fails is
 * F itself, which is precisely what "hold every other constraint fixed" means.
 * The trail is the same bookkeeping read differently: a plant survives step j iff
 * its earliest failing step comes after j, so the trail counts are suffix sums of
 * one histogram.
 */
export function evaluate(data: Dataset, c: Constraints): Evaluation {
  const text = c.text.trim();

  // The unconstrained evaluation is what she opens to, and what she lands on
  // every time she clears. It is also the most expensive one there is: nothing
  // is excluded, so every facet gets tallied over every plant. It cannot change
  // for a given dataset, so pay for it once.
  const unconstrained = !text && c.atoms.length === 0;
  if (unconstrained) {
    const cached = BASE.get(data);
    if (cached) return { results: data.plants, counts: cached.counts, trail: [], coverage: cached.coverage };
  }

  const ranked = text ? withHerWords(data, text) : null;
  const textAllowed = ranked ? new Set(ranked) : null;
  const base = (p: Plant) => (textAllowed ? textAllowed.has(p.slug) : true);

  const { facets, zone, edible } = atomsState(c.atoms);
  const facetKeys = Object.keys(facets);
  const { steps, index: stepIndex } = stepsOf(c.atoms);

  const results: Plant[] = [];
  const counts: Record<string, Map<string, number>> = {};
  const coverage: Record<string, { covered: number; of: number }> = {};
  for (const f of FACETS) {
    counts[f.key] = new Map();
    coverage[f.key] = { covered: 0, of: 0 };
  }

  // hist[j] = plants whose earliest failing step is j; hist[steps.length] = survivors.
  const hist = new Array<number>(steps.length + 1).fill(0);
  const failed: string[] = [];
  let textPassed = 0;

  for (const p of data.plants) {
    if (!base(p)) continue;
    textPassed += 1;

    // Once per plant, not once per facet. Fourteen lookups a plant is 123,000 a
    // pass, which is the same order of waste this loop was built to delete.
    const hers = data.mine.get(p.id);

    failed.length = 0;
    for (const key of facetKeys) if (!facetOk(p, key, facets[key], hers)) failed.push(key);
    if (zone !== null && !zoneOk(p, zone, hers)) failed.push(ZONE_KEY);
    if (edible && !p.edible) failed.push(EDIBLE_KEY);

    if (failed.length === 0) {
      results.push(p);
      hist[steps.length] += 1;
      for (const f of FACETS) {
        const v = ACCESS[f.key](p, hers);
        tally(counts[f.key], v);
        coverage[f.key].of += 1;
        if (!isEmpty(v)) coverage[f.key].covered += 1;
      }
      continue;
    }

    let first = steps.length;
    for (const key of failed) {
      const i = stepIndex.get(key)!;
      if (i < first) first = i;
    }
    hist[first] += 1;

    // A plant that fails only THIS facet still belongs in its denominator: it is
    // reachable, it just has no value here. That is exactly the plant the coverage
    // note exists to account for.
    if (failed.length === 1) {
      const key = failed[0];
      const m = counts[key];
      if (m) {
        const v = ACCESS[key](p, hers);
        tally(m, v);
        coverage[key].of += 1;
        if (!isEmpty(v)) coverage[key].covered += 1;
      }
    }
  }

  // Results keep the ranking: text relevance when searching, else the dataset's
  // own richness order, which it ships pre-sorted by.
  if (ranked) {
    const keep = new Set(results.map((p) => p.slug));
    results.length = 0;
    for (const slug of ranked) {
      const p = data.bySlug.get(slug);
      if (p && keep.has(slug)) results.push(p);
    }
  }

  // Survivors after step j are the plants that fail no step at or before j.
  const alive = new Array<number>(steps.length + 2).fill(0);
  for (let j = steps.length; j >= 0; j--) alive[j] = alive[j + 1] + hist[j];

  const trail: TrailStep[] = [];
  if (text) trail.push({ atoms: [], key: "", label: `“${text}”`, count: textPassed });
  steps.forEach((st, j) => {
    const head = atomLabel(st.atoms[0]);
    const label =
      st.atoms.length > 1
        ? st.atoms.map((a) => atomLabel(a).value).join(" or ")
        : head.value;
    trail.push({ atoms: st.atoms, key: head.key, label, count: alive[j + 1] });
  });

  if (unconstrained) BASE.set(data, { counts, coverage });
  return { results, counts, trail, coverage };
}

type Base = { counts: Record<string, Map<string, number>>; coverage: Record<string, { covered: number; of: number }> };
const BASE = new WeakMap<Dataset, Base>();

/** How many plants survive the current constraints plus a few more. */
export function countWith(data: Dataset, c: Constraints, extra: Atom[]): number {
  const { facets, zone, edible } = atomsState([...c.atoms, ...extra]);
  const text = c.text.trim();
  const allowed = text ? new Set(withHerWords(data, text)) : null;

  let n = 0;
  outer: for (const p of data.plants) {
    if (allowed && !allowed.has(p.slug)) continue;
    const hers = data.mine.get(p.id);
    if (!zoneOk(p, zone, hers)) continue;
    if (edible && !p.edible) continue;
    for (const key in facets) if (!facetOk(p, key, facets[key], hers)) continue outer;
    n += 1;
  }
  return n;
}

export { facetsOf, zoneOf };
