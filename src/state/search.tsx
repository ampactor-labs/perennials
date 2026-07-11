import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import type { Plant } from "@/data/model";
import { useDataState, type Dataset } from "@/data/store";
import {
  addAtom,
  decodeConstraints,
  emptyConstraints,
  encodeConstraints,
  hasAtom,
  removeAtom,
  toggleAtom,
  zoneOf,
  type Atom,
  type Constraints,
} from "@/lib/constraints";
import { evaluate, type Evaluation } from "@/lib/query";
import { applySpot as applySpotTo, type Spot } from "@/lib/spots";

type SearchValue = {
  ready: boolean;
  data: Dataset | null;
  total: number;
  constraints: Constraints;
  results: Plant[];
  counts: Evaluation["counts"];
  trail: Evaluation["trail"];
  zone: number | null;
  add: (a: Atom) => void;
  remove: (a: Atom) => void;
  toggle: (a: Atom) => void;
  has: (a: Atom) => boolean;
  setText: (t: string) => void;
  setView: (v: "list" | "guild") => void;
  applySpot: (s: Spot) => void;
  clearAll: () => void;
};

const Ctx = createContext<SearchValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const state = useDataState();
  const data = state.status === "ready" ? state.data : null;
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();

  // URL is the initial source of truth; after that, state drives and the URL
  // follows via replace (so constraint edits don't spam history).
  const [constraints, setConstraints] = useState<Constraints>(() => decodeConstraints(params));
  const lastWritten = useRef<string>("");

  useEffect(() => {
    if (pathname !== "/") return;
    const next = encodeConstraints(constraints).toString();
    if (next === params.toString() || next === lastWritten.current) return;
    lastWritten.current = next;
    setParams(new URLSearchParams(next), { replace: true });
  }, [constraints, pathname, params, setParams]);

  const evaluation = useMemo<Evaluation>(
    () => (data ? evaluate(data, constraints) : { results: [], counts: {}, trail: [] }),
    [data, constraints],
  );

  const add = useCallback((a: Atom) => setConstraints((c) => addAtom(c, a)), []);
  const remove = useCallback((a: Atom) => setConstraints((c) => removeAtom(c, a)), []);
  const toggle = useCallback((a: Atom) => setConstraints((c) => toggleAtom(c, a)), []);
  const setText = useCallback((text: string) => setConstraints((c) => ({ ...c, text })), []);
  const setView = useCallback((view: "list" | "guild") => setConstraints((c) => ({ ...c, view })), []);
  const applySpot = useCallback((s: Spot) => setConstraints((c) => applySpotTo(c, s)), []);
  const clearAll = useCallback(
    () => setConstraints((c) => ({ ...emptyConstraints(), view: c.view })),
    [],
  );

  const value: SearchValue = {
    ready: !!data,
    data,
    total: data?.plants.length ?? 0,
    constraints,
    results: evaluation.results,
    counts: evaluation.counts,
    trail: evaluation.trail,
    zone: zoneOf(constraints),
    add,
    remove,
    toggle,
    has: (a) => hasAtom(constraints, a),
    setText,
    setView,
    applySpot,
    clearAll,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearch(): SearchValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSearch must be inside SearchProvider");
  return v;
}
