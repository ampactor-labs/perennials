// The constraint model: an ORDERED list of atoms. Order matters — it's what
// the collapse trail renders, and it round-trips through the URL so any
// constraint set is a shareable link.

import { bloomPeriodLabel } from "./bloom";

export type Atom =
  | { kind: "facet"; key: string; value: string }
  | { kind: "zone"; zone: number }
  | { kind: "edible" };

export type Constraints = {
  atoms: Atom[];
  text: string;
  view: "list" | "guild";
};

export const emptyConstraints = (): Constraints => ({ atoms: [], text: "", view: "list" });

export function atomId(a: Atom): string {
  if (a.kind === "facet") return `f:${a.key}:${a.value}`;
  if (a.kind === "zone") return "zone";
  return "edible";
}

export function atomLabel(a: Atom): { key: string; value: string } {
  if (a.kind === "facet") {
    const value = a.key === "bloomPeriod" ? bloomPeriodLabel(a.value) : a.value;
    return { key: FACET_LABEL[a.key] ?? a.key, value };
  }
  if (a.kind === "zone") return { key: "Hardy in", value: `zone ${a.zone}` };
  return { key: "", value: "Edible" };
}

export function hasAtom(c: Constraints, a: Atom): boolean {
  const id = atomId(a);
  // zone is single-slot: any zone atom counts as present
  return c.atoms.some((x) => atomId(x) === id);
}

export function addAtom(c: Constraints, a: Atom): Constraints {
  if (a.kind === "zone") {
    // replace any existing zone
    const atoms = c.atoms.filter((x) => x.kind !== "zone");
    return { ...c, atoms: [...atoms, a] };
  }
  if (hasAtom(c, a)) return c;
  return { ...c, atoms: [...c.atoms, a] };
}

export function removeAtom(c: Constraints, a: Atom): Constraints {
  const id = atomId(a);
  return { ...c, atoms: c.atoms.filter((x) => atomId(x) !== id) };
}

export function toggleAtom(c: Constraints, a: Atom): Constraints {
  return hasAtom(c, a) && !(a.kind === "zone" && zoneOf(c) !== a.zone)
    ? removeAtom(c, a)
    : addAtom(c, a);
}

export function zoneOf(c: Constraints): number | null {
  const z = c.atoms.find((x) => x.kind === "zone");
  return z && z.kind === "zone" ? z.zone : null;
}

export function facetsOf(c: Constraints): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of c.atoms) {
    if (a.kind !== "facet") continue;
    (out[a.key] ??= []).push(a.value);
  }
  return out;
}

/* ---- URL codec -------------------------------------------------------- */
// Repeated query keys preserve atom order exactly: ?water=Wet&light=Full+shade
// Facet keys get short public names; everything else is dropped politely.

const KEY_TO_PARAM: Record<string, string> = {
  layer: "layer",
  light: "light",
  water: "water",
  soil: "soil",
  lifeCycle: "cycle",
  growth: "growth",
  edibleParts: "part",
  functions: "use",
  attracts: "attracts",
  bloomColor: "bloom",
  bloomPeriod: "bloomtime",
  warnings: "caution",
  family: "family",
  nativeTo: "native",
};
const PARAM_TO_KEY = Object.fromEntries(Object.entries(KEY_TO_PARAM).map(([k, v]) => [v, k]));

const FACET_LABEL: Record<string, string> = {
  layer: "Layer",
  light: "Light",
  water: "Water",
  soil: "Soil",
  lifeCycle: "Life cycle",
  growth: "Growth",
  edibleParts: "Edible part",
  functions: "Use",
  attracts: "Attracts",
  bloomColor: "Bloom color",
  bloomPeriod: "Bloom period",
  warnings: "Caution",
  family: "Family",
  nativeTo: "Native to",
};
export { FACET_LABEL };

export function encodeConstraints(c: Constraints): URLSearchParams {
  const p = new URLSearchParams();
  for (const a of c.atoms) {
    if (a.kind === "facet") p.append(KEY_TO_PARAM[a.key] ?? a.key, a.value);
    else if (a.kind === "zone") p.append("zone", String(a.zone));
    else p.append("edible", "1");
  }
  if (c.text.trim()) p.set("q", c.text.trim());
  if (c.view === "guild") p.set("view", "guild");
  return p;
}

export function decodeConstraints(p: URLSearchParams): Constraints {
  const c = emptyConstraints();
  for (const [k, v] of p) {
    if (k === "q") c.text = v;
    else if (k === "view") c.view = v === "guild" ? "guild" : "list";
    else if (k === "edible") c.atoms.push({ kind: "edible" });
    else if (k === "zone") {
      const z = Number(v);
      if (Number.isInteger(z) && z >= 1 && z <= 13) c.atoms.push({ kind: "zone", zone: z });
    } else if (PARAM_TO_KEY[k]) {
      c.atoms.push({ kind: "facet", key: PARAM_TO_KEY[k], value: v });
    }
  }
  // dedupe defensively (hand-edited URLs)
  const seen = new Set<string>();
  c.atoms = c.atoms.filter((a) => {
    const id = atomId(a);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return c;
}
