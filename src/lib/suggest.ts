import type { Dataset } from "@/data/store";
import type { Plant } from "@/data/model";
import type { Atom } from "./constraints";
import { FACET_LABEL } from "./constraints";

export type ConstraintSuggestion = {
  type: "constraint";
  atom: Atom;
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

export function suggest(
  data: Dataset,
  lexicon: Entry[],
  input: string,
  max = 7,
): Suggestion[] {
  const q = input.trim().toLowerCase();
  const out: ConstraintSuggestion[] = [];

  if (!q) return [];

  // Zone: "zone 6", "z6", or a bare small number.
  const zm = q.match(ZONE_RE);
  if (zm) {
    const z = Number(zm[1] ?? zm[2]);
    if (z >= 1 && z <= 13) {
      const count = data.plants.reduce(
        (n, p) => n + (p.hardiness && p.hardiness.min <= z && z <= p.hardiness.max ? 1 : 0),
        0,
      );
      out.push({
        type: "constraint",
        atom: { kind: "zone", zone: z },
        label: `Hardy in zone ${z}`,
        group: "Hardiness",
        count,
      });
    }
  }

  // Constraint entries: score by how the query hits label/tokens, weight by
  // how many plants the value reaches (log-ish, so big facets don't drown).
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
  for (const [, e] of scored) {
    if (out.length >= max) break;
    out.push({ type: "constraint", atom: e.atom, label: e.label, group: e.group, count: e.count });
  }

  // Top plant-name matches ride along beneath the constraints.
  const plants: PlantSuggestion[] = data.index
    .search(input, { prefix: true, fuzzy: 0.15 })
    .slice(0, 4)
    .map((r) => data.bySlug.get(r.slug as string))
    .filter((p): p is Plant => !!p)
    .map((plant) => ({ type: "plant", plant }));

  return [...out, ...plants];
}
