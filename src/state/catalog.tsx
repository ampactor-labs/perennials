import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LoadedPlant } from "@/data/types";
import {
  emptyFilters,
  facetCounts,
  FACET_IDS,
  activeFilterCount,
  type FacetId,
  type Filters,
} from "@/lib/filters";
import { queryPlants } from "@/lib/search";

type CatalogValue = {
  filters: Filters;
  results: LoadedPlant[];
  activeCount: number;
  setText: (t: string) => void;
  toggle: (id: FacetId, value: string) => void;
  isChecked: (id: FacetId, value: string) => boolean;
  clearFacet: (id: FacetId) => void;
  setZone: (z: number | null) => void;
  setSelfSeeds: (v: boolean | null) => void;
  applyPreset: (p: Partial<Filters>) => void;
  clearAll: () => void;
  countsFor: (id: FacetId) => Map<string, number>;
};

const Ctx = createContext<CatalogValue | null>(null);
const ZONE_KEY = "perrenials.zone";

function readZone(): number {
  try {
    const raw = localStorage.getItem(ZONE_KEY);
    return raw === null ? 6 : Number(JSON.parse(raw));
  } catch {
    return 6;
  }
}

function toggleGroup(current: string[], values: string[]): string[] {
  const allActive = values.every((v) => current.includes(v));
  if (allActive) return current.filter((v) => !values.includes(v));
  const set = new Set(current);
  for (const v of values) set.add(v);
  return [...set];
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(() => ({ ...emptyFilters(), zone: readZone() }));

  // Her home zone is the one filter worth remembering between visits.
  useEffect(() => {
    try {
      if (filters.zone !== null) localStorage.setItem(ZONE_KEY, JSON.stringify(filters.zone));
    } catch {
      /* ignore */
    }
  }, [filters.zone]);

  const patch = useCallback((p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p })), []);

  const setText = useCallback((t: string) => patch({ text: t }), [patch]);
  const setZone = useCallback((z: number | null) => patch({ zone: z }), [patch]);
  const setSelfSeeds = useCallback((v: boolean | null) => patch({ selfSeeds: v }), [patch]);

  const toggle = useCallback((id: FacetId, value: string) => {
    setFilters((f) => {
      const cur = f[id];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...f, [id]: next };
    });
  }, []);

  const clearFacet = useCallback((id: FacetId) => setFilters((f) => ({ ...f, [id]: [] })), []);

  const applyPreset = useCallback((p: Partial<Filters>) => {
    setFilters((f) => {
      const next: Filters = { ...f };
      for (const [k, v] of Object.entries(p)) {
        if (Array.isArray(v)) next[k as FacetId] = toggleGroup(f[k as FacetId], v);
        else (next as Record<string, unknown>)[k] = v;
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(
    () => setFilters((f) => ({ ...emptyFilters(), zone: f.zone })),
    [],
  );

  const results = useMemo(() => queryPlants(filters), [filters]);
  const counts = useMemo(() => {
    const m = {} as Record<FacetId, Map<string, number>>;
    for (const id of FACET_IDS) m[id] = facetCounts(filters, id);
    return m;
  }, [filters]);

  const value: CatalogValue = {
    filters,
    results,
    activeCount: activeFilterCount(filters),
    setText,
    toggle,
    isChecked: (id, value) => filters[id].includes(value),
    clearFacet,
    setZone,
    setSelfSeeds,
    applyPreset,
    clearAll,
    countsFor: (id) => counts[id],
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCatalog must be used within CatalogProvider");
  return v;
}
