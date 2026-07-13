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
import { coverageOf, evaluate, type Evaluation } from "@/lib/query";
import { applySpot as applySpotTo, type Spot } from "@/lib/spots";

type SearchValue = {
  ready: boolean;
  data: Dataset | null;
  total: number;
  constraints: Constraints;
  results: Plant[];
  counts: Evaluation["counts"];
  trail: Evaluation["trail"];
  /** How many plants have any value at all for each facet, so the UI can say so. */
  coverage: Record<string, number>;
  /** How many results are revealed. Lives here so Back doesn't lose her place. */
  limit: number;
  showMore: () => void;
  zone: number | null;
  add: (a: Atom) => void;
  remove: (a: Atom) => void;
  removeAll: (a: Atom[]) => void;
  toggle: (a: Atom) => void;
  has: (a: Atom) => boolean;
  setText: (t: string) => void;
  setView: (v: "list" | "guild") => void;
  applySpot: (s: Spot) => void;
  clearAll: () => void;
};

const Ctx = createContext<SearchValue | null>(null);

/** Results revealed per page, in the grid and in each guild layer. */
export const PAGE = 48;

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

  // Depends only on the dataset, so it survives every constraint change.
  const coverage = useMemo(() => (data ? coverageOf(data.plants) : {}), [data]);

  // How far she has scrolled into the results, kept up here so it survives the
  // trip into a plant page and back. It used to live inside ResultGrid, which
  // unmounts on navigation — so Back reset her to the first 48 of 300.
  //
  // The reset happens during render rather than in an effect. An effect fires
  // after React has already mounted the new results against the stale limit, so
  // a tap made 300 cards appear and then immediately unmounted 250 of them.
  const [limit, setLimit] = useState(PAGE);
  const [limitFor, setLimitFor] = useState<Plant[] | null>(null);
  if (limitFor !== evaluation.results) {
    setLimitFor(evaluation.results);
    setLimit(PAGE);
  }
  const showMore = useCallback(() => setLimit((l) => l + PAGE), []);

  const add = useCallback((a: Atom) => setConstraints((c) => addAtom(c, a)), []);
  const remove = useCallback((a: Atom) => setConstraints((c) => removeAtom(c, a)), []);
  const removeAll = useCallback(
    (as: Atom[]) => setConstraints((c) => as.reduce(removeAtom, c)),
    [],
  );
  const toggle = useCallback((a: Atom) => setConstraints((c) => toggleAtom(c, a)), []);
  const setText = useCallback((text: string) => setConstraints((c) => ({ ...c, text })), []);
  const setView = useCallback((view: "list" | "guild") => setConstraints((c) => ({ ...c, view })), []);
  const applySpot = useCallback((s: Spot) => setConstraints((c) => applySpotTo(c, s)), []);
  const clearAll = useCallback(
    () => setConstraints((c) => ({ ...emptyConstraints(), view: c.view })),
    [],
  );

  // A fresh object literal here re-rendered every useSearch() consumer on every
  // render of this provider — and the URL-sync effect above makes that twice per
  // constraint change.
  const value = useMemo<SearchValue>(
    () => ({
      ready: !!data,
      data,
      total: data?.plants.length ?? 0,
      constraints,
      results: evaluation.results,
      counts: evaluation.counts,
      trail: evaluation.trail,
      coverage,
      limit,
      showMore,
      zone: zoneOf(constraints),
      add,
      remove,
      removeAll,
      toggle,
      has: (a) => hasAtom(constraints, a),
      setText,
      setView,
      applySpot,
      clearAll,
    }),
    [
      data, constraints, evaluation, coverage, limit, showMore,
      add, remove, removeAll, toggle, setText, setView, applySpot, clearAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearch(): SearchValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSearch must be inside SearchProvider");
  return v;
}
