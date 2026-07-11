import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Plant } from "@/data/model";
import { useDataState } from "@/data/store";
import {
  activeChips,
  activeCount,
  emptyConstraints,
  evaluate,
  type Constraints,
} from "@/lib/query";

type SearchValue = {
  ready: boolean;
  total: number;
  constraints: Constraints;
  results: Plant[];
  counts: Record<string, Map<string, number>>;
  chips: { key: string; label: string; value: string }[];
  active: number;
  setText: (t: string) => void;
  setZone: (z: number | null) => void;
  toggleEdible: () => void;
  toggle: (key: string, value: string) => void;
  clearFacet: (key: string) => void;
  clearAll: () => void;
  isSelected: (key: string, value: string) => boolean;
};

const Ctx = createContext<SearchValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const state = useDataState();
  const data = state.status === "ready" ? state.data : null;
  const [constraints, setConstraints] = useState<Constraints>(emptyConstraints);

  const { results, counts } = useMemo(
    () => (data ? evaluate(data, constraints) : { results: [], counts: {} }),
    [data, constraints],
  );

  const setText = useCallback((text: string) => setConstraints((c) => ({ ...c, text })), []);
  const setZone = useCallback((zone: number | null) => setConstraints((c) => ({ ...c, zone })), []);
  const toggleEdible = useCallback(
    () => setConstraints((c) => ({ ...c, edibleOnly: !c.edibleOnly })),
    [],
  );
  const toggle = useCallback((key: string, value: string) => {
    setConstraints((c) => {
      const cur = c.facets[key] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      const facets = { ...c.facets };
      if (next.length) facets[key] = next;
      else delete facets[key];
      return { ...c, facets };
    });
  }, []);
  const clearFacet = useCallback((key: string) => {
    setConstraints((c) => {
      const facets = { ...c.facets };
      delete facets[key];
      return { ...c, facets };
    });
  }, []);
  const clearAll = useCallback(() => setConstraints(emptyConstraints()), []);

  const value: SearchValue = {
    ready: !!data,
    total: data?.plants.length ?? 0,
    constraints,
    results,
    counts,
    chips: activeChips(constraints),
    active: activeCount(constraints),
    setText,
    setZone,
    toggleEdible,
    toggle,
    clearFacet,
    clearAll,
    isSelected: (key, value) => (constraints.facets[key] ?? []).includes(value),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearch(): SearchValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSearch must be inside SearchProvider");
  return v;
}
