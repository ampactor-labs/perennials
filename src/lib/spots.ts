// "Spots" — her named places. A spot is a saved set of SITE conditions (light,
// water, soil, zone). Applying one swaps in that place's conditions and leaves
// intent constraints (edible, functions, layer…) alone.
import { useCallback, useSyncExternalStore } from "react";
import type { Atom, Constraints } from "./constraints";

export type Spot = {
  id: string;
  name: string;
  zone: number | null;
  facets: Record<string, string[]>; // light / water / soil only
};

export const SITE_KEYS = ["light", "water", "soil"] as const;
const LS_KEY = "perennials.spots.v1";

let cache: Spot[] | null = null;
const listeners = new Set<() => void>();

function read(): Spot[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as Spot[];
  } catch {
    cache = [];
  }
  return cache;
}

function write(spots: Spot[]) {
  cache = spots;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(spots));
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}

export function useSpots() {
  const spots = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => [],
  );

  const save = useCallback((name: string, c: Constraints): Spot => {
    const facets: Record<string, string[]> = {};
    let zone: number | null = null;
    for (const a of c.atoms) {
      if (a.kind === "zone") zone = a.zone;
      else if (a.kind === "facet" && (SITE_KEYS as readonly string[]).includes(a.key)) {
        (facets[a.key] ??= []).push(a.value);
      }
    }
    const spot: Spot = { id: `s${Date.now().toString(36)}`, name: name.trim(), zone, facets };
    write([...read(), spot]);
    return spot;
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((s) => s.id !== id));
  }, []);

  return { spots, save, remove };
}

/** The atoms a spot contributes, in a stable site-reading order. */
export function spotAtoms(spot: Spot): Atom[] {
  const atoms: Atom[] = [];
  for (const key of SITE_KEYS) for (const value of spot.facets[key] ?? []) atoms.push({ kind: "facet", key, value });
  if (spot.zone !== null) atoms.push({ kind: "zone", zone: spot.zone });
  return atoms;
}

/** Replace all current site conditions with this spot's (intent atoms stay). */
export function applySpot(c: Constraints, spot: Spot): Constraints {
  const kept = c.atoms.filter(
    (a) => a.kind === "edible" || (a.kind === "facet" && !(SITE_KEYS as readonly string[]).includes(a.key)),
  );
  return { ...c, atoms: [...spotAtoms(spot), ...kept] };
}

/** A spot is active when every one of its atoms is currently applied. */
export function spotActive(c: Constraints, spot: Spot): boolean {
  const have = new Set(
    c.atoms.map((a) =>
      a.kind === "facet" ? `f:${a.key}:${a.value}` : a.kind === "zone" ? `z:${a.zone}` : "e",
    ),
  );
  return spotAtoms(spot).every((a) =>
    have.has(a.kind === "facet" ? `f:${a.key}:${a.value}` : a.kind === "zone" ? `z:${a.zone}` : "e"),
  );
}

/** Does the current constraint set contain any site conditions worth saving? */
export function hasSiteConditions(c: Constraints): boolean {
  return c.atoms.some(
    (a) => a.kind === "zone" || (a.kind === "facet" && (SITE_KEYS as readonly string[]).includes(a.key)),
  );
}
