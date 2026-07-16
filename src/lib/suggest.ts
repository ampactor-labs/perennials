import type { Dataset } from "@/data/store";
import type { Plant } from "@/data/model";
import type { Atom, Constraints } from "./constraints";
import { atomId, hasAtom, FACET_LABEL } from "./constraints";
import { countWith } from "./query";

export type ConstraintSuggestion = {
  type: "constraint";
  /** More than one when a phrase resolves across facets: "wet shade" → both. */
  atoms: Atom[];
  label: string;
  group: string;
  count: number;
};
export type PlantSuggestion = { type: "plant"; plant: Plant };
export type Suggestion = ConstraintSuggestion | PlantSuggestion;

type Entry = { atom: Atom; label: string; group: string; count: number; tokens: string[] };

// Gardener vocabulary that doesn't literally appear in the data values.
// Maps a spoken word to the facet values it should summon.
const SYNONYMS: Record<string, [key: string, value: string][]> = {
  sun: [["light", "Full sun"]],
  sunny: [["light", "Full sun"]],
  shade: [["light", "Full shade"], ["light", "Partial sun/shade"]],
  shady: [["light", "Full shade"], ["light", "Partial sun/shade"]],
  partial: [["light", "Partial sun/shade"]],
  part: [["light", "Partial sun/shade"]],
  dry: [["water", "Dry"]],
  drought: [["water", "Dry"]],
  moist: [["water", "Moist"]],
  damp: [["water", "Moist"]],
  wet: [["water", "Wet"]],
  bog: [["water", "Wet"]],
  boggy: [["water", "Wet"]],
  sandy: [["soil", "Light (sandy)"]],
  sand: [["soil", "Light (sandy)"]],
  loam: [["soil", "Medium"]],
  clay: [["soil", "Heavy (clay)"]],
  heavy: [["soil", "Heavy (clay)"]],
  tree: [["layer", "Trees"], ["layer", "Tall trees"]],
  shrub: [["layer", "Shrubs"]],
  bush: [["layer", "Shrubs"]],
  vine: [["layer", "Vines"]],
  climber: [["layer", "Vines"]],
  herb: [["layer", "Herbs"]],
  groundcover: [["layer", "Ground cover"], ["functions", "Ground cover"]],
  ground: [["layer", "Ground cover"]],
  nitrogen: [["functions", "Nitrogen fixer"]],
  nfixer: [["functions", "Nitrogen fixer"]],
  windbreak: [["functions", "Hedgerow"]],
  hedge: [["functions", "Hedgerow"]],
  bee: [["attracts", "Bees"]],
  bees: [["attracts", "Bees"]],
  butterfly: [["attracts", "Butterflies"]],
  butterflies: [["attracts", "Butterflies"]],
  moth: [["attracts", "Moths"]],
  hoverfly: [["attracts", "Hoverflies"]],
  hoverflies: [["attracts", "Hoverflies"]],
  hummingbird: [["attracts", "Hummingbirds"]],
  hummingbirds: [["attracts", "Hummingbirds"]],
  pollinator: [["attracts", "Bees"], ["attracts", "Butterflies"], ["attracts", "Hoverflies"]],
  pollinators: [["attracts", "Bees"], ["attracts", "Butterflies"], ["attracts", "Hoverflies"]],
  beneficial: [["attracts", "Hoverflies"], ["attracts", "Wasps"]],
  insectary: [["attracts", "Hoverflies"], ["attracts", "Wasps"], ["attracts", "Bees"]],
  toxic: [["warnings", "Toxic"]],
  poison: [["warnings", "Toxic"]],
  poisonous: [["warnings", "Toxic"]],
  invasive: [["warnings", "Invasive"]],
  weedy: [["warnings", "Weed potential"]],
};

export function buildLexicon(data: Dataset): Entry[] {
  const entries: Entry[] = [];
  const byId = new Map<string, Entry>();

  for (const [key, values] of Object.entries(data.facets)) {
    const group = FACET_LABEL[key] ?? key;
    for (const { value, count } of values) {
      const e: Entry = {
        atom: { kind: "facet", key, value },
        label: value,
        group,
        count,
        tokens: value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
      };
      entries.push(e);
      byId.set(`${key}:${value}`, e);
    }
  }
  // Attach synonym tokens to their targets.
  for (const [word, targets] of Object.entries(SYNONYMS)) {
    for (const [key, value] of targets) {
      const e = byId.get(`${key}:${value}`);
      if (e && !e.tokens.includes(word)) e.tokens.push(word);
    }
  }
  // Edible as a first-class suggestion.
  entries.push({
    atom: { kind: "edible" },
    label: "Edible",
    group: "Use",
    count: data.meta.edibleCount,
    tokens: ["edible", "food", "eat"],
  });
  return entries;
}

const ZONE_RE = /^(?:z|zone)\s*(\d{1,2})$|^(\d{1,2})$/;

/** Best lexicon hits for one word or phrase, strongest first. */
function score(lexicon: Entry[], q: string): Entry[] {
  const scored: [number, Entry][] = [];
  for (const e of lexicon) {
    const label = e.label.toLowerCase();
    let s = 0;
    if (label.startsWith(q)) s = 3;
    else if (e.tokens.some((t) => t.startsWith(q))) s = 2;
    else if (q.length >= 3 && label.includes(q)) s = 1;
    if (s > 0) scored.push([s * 10 + Math.min(Math.log10(e.count + 1), 4), e]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map(([, e]) => e);
}

export type SuggestContext = {
  constraints: Constraints;
  /** The live, constraint-aware counts from the current evaluation. */
  counts: Record<string, Map<string, number>>;
};

/**
 * What the omnibox offers, and how many plants each offer would actually reach.
 *
 * Two things this gets right that it previously didn't.
 *
 * It splits on whitespace. The whole input used to be matched as one string
 * against one label at a time, so "wet shade" (the app's own placeholder, and
 * the first thing anybody types) matched no facet value and produced nothing.
 * The phrase is tried whole first (plenty of real values are two words: "Full
 * shade", "Nitrogen fixer"), then word by word, and when the words land on
 * different facets they are also offered together as one tap.
 *
 * And the counts are the live ones. They used to come from the whole-catalog
 * lexicon while the facet rail showed constraint-aware numbers, so with Water:
 * Wet applied the omnibox offered "Full shade — 576" and tapping it gave 58.
 * The same number, in the same slot, meaning two different things. A suggestion
 * that would reach nothing is now dropped outright rather than offered as a
 * dead end.
 */
export function suggest(
  data: Dataset,
  lexicon: Entry[],
  input: string,
  ctx: SuggestContext,
  max = 7,
): Suggestion[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];

  const reach = (a: Atom): number => {
    if (a.kind === "facet") return ctx.counts[a.key]?.get(a.value) ?? 0;
    return countWith(data, ctx.constraints, [a]);
  };

  const out: ConstraintSuggestion[] = [];
  const seen = new Set<string>();
  const offer = (atoms: Atom[], label: string, group: string) => {
    const id = atoms.map(atomId).sort().join("|");
    if (seen.has(id) || out.length >= max) return;
    if (atoms.every((a) => hasAtom(ctx.constraints, a))) return;
    const count = atoms.length === 1 ? reach(atoms[0]) : countWith(data, ctx.constraints, atoms);
    if (count === 0) return; // a dead end is not a suggestion
    seen.add(id);
    out.push({ type: "constraint", atoms, label, group, count });
  };

  // Zone: "zone 6", "z6", or a bare small number.
  const zm = q.match(ZONE_RE);
  if (zm) {
    const z = Number(zm[1] ?? zm[2]);
    if (z >= 1 && z <= 13) offer([{ kind: "zone", zone: z }], `Hardy in zone ${z}`, "Hardiness");
  }

  const words = q.split(/\s+/).filter(Boolean);

  // The phrase as she typed it.
  const whole = score(lexicon, q);

  // Then each word on its own, so a phrase that no single value spells still lands.
  const perWord = words.length > 1 ? words.map((w) => score(lexicon, w)[0]).filter(Boolean) : [];

  // Two words, two different facets: offer the conjunction the placeholder promises.
  const distinct = perWord.filter(
    (e, i, all) =>
      e.atom.kind === "facet" &&
      all.findIndex((o) => o.atom.kind === "facet" && o.atom.key === (e.atom as { key: string }).key) === i,
  );
  if (whole.length === 0 && distinct.length > 1) {
    offer(
      distinct.map((e) => e.atom),
      distinct.map((e) => e.label).join(" + "),
      "Both",
    );
  }

  for (const e of whole) offer([e.atom], e.label, e.group);
  for (const e of perWord) offer([e.atom], e.label, e.group);

  // Plant names ride along beneath. AND across terms, so a two-word phrase that
  // names no plant returns nothing instead of fuzzy-matching a typo in a binomial,
  // which is how "wet shade" used to surface Ribes petiolare, "Wetern blackcurrant".
  const plants: PlantSuggestion[] =
    q.length < 2
      ? []
      : data.index
          .search(input, { prefix: true, fuzzy: 0.15, combineWith: "AND" })
          .slice(0, 4)
          .map((r) => data.bySlug.get(r.slug as string))
          .filter((p): p is Plant => !!p)
          .map((plant) => ({ type: "plant", plant }));

  return [...out, ...plants];
}
