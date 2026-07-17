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
import { learnHomeZone } from "@/lib/homeZone";
import { coverageOf, evaluate, ZONE_COVERAGE, type Evaluation } from "@/lib/query";
import { applySpot as applySpotTo, type Spot } from "@/lib/spots";

type SearchValue = {
  ready: boolean;
  data: Dataset | null;
  total: number;
  constraints: Constraints;
  results: Plant[];
  counts: Evaluation["counts"];
  trail: Evaluation["trail"];
  /** How much of the set she is LOOKING AT has a value for each facet. Catalogue-wide
   *  coverage is a number about the world and it understates her search badly. */
  coverage: Record<string, { covered: number; of: number }>;
  /** How many plants in the whole catalogue have any hardiness record at all. */
  hardinessKnown: number;
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
  /** The constraints the last clear or trail-step removal threw away, if any. */
  undoable: Constraints | null;
  undo: () => void;
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
    () => (data ? evaluate(data, constraints) : { results: [], counts: {}, trail: [], coverage: {} }),
    [data, constraints],
  );

  // Hardiness is not a facet (it has its own control), so its coverage is counted
  // over the whole catalogue, once per dataset.
  const hardinessKnown = useMemo(
    () => (data ? coverageOf(data.plants, data.mine)[ZONE_COVERAGE] ?? 0 : 0),
    [data],
  );

  // How far she has scrolled into the results, kept up here so it survives the
  // trip into a plant page and back. It used to live inside ResultGrid, which
  // unmounts on navigation, so Back reset her to the first 48 of 300.
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

  // Constraint edits are written with { replace: true } so they don't spam the
  // history, which means the browser's Back button cannot take one back. That is
  // fine for adding a filter and not fine for wiping the search: keep the last
  // thing we destroyed, and offer it back.
  const [undoable, setUndoable] = useState<Constraints | null>(null);

  // A zone she names is the guide's best evidence of where home is. The default
  // order follows it (see data/store.tsx); nothing is asked, nothing is filtered.
  const add = useCallback((a: Atom) => {
    if (a.kind === "zone") learnHomeZone(a.zone);
    setConstraints((c) => addAtom(c, a));
  }, []);
  const remove = useCallback((a: Atom) => setConstraints((c) => removeAtom(c, a)), []);
  const removeAll = useCallback((as: Atom[]) => {
    setConstraints((c) => {
      setUndoable(c);
      return as.reduce(removeAtom, c);
    });
  }, []);
  const toggle = useCallback((a: Atom) => setConstraints((c) => toggleAtom(c, a)), []);
  const setText = useCallback((text: string) => setConstraints((c) => ({ ...c, text })), []);
  const setView = useCallback((view: "list" | "guild") => setConstraints((c) => ({ ...c, view })), []);
  const applySpot = useCallback((s: Spot) => {
    if (s.zone !== null) learnHomeZone(s.zone);
    setConstraints((c) => applySpotTo(c, s));
  }, []);
  const clearAll = useCallback(() => {
    setConstraints((c) => {
      setUndoable(c);
      return { ...emptyConstraints(), view: c.view };
    });
  }, []);
  const undo = useCallback(() => {
    setUndoable((prev) => {
      if (prev) setConstraints(prev);
      return null;
    });
  }, []);

  // A fresh object literal here re-rendered every useSearch() consumer on every
  // render of this provider, and the URL-sync effect above makes that twice per
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
      coverage: evaluation.coverage,
      hardinessKnown,
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
      undoable,
      undo,
    }),
    [
      data, constraints, evaluation, hardinessKnown, limit, showMore,
      add, remove, removeAll, toggle, setText, setView, applySpot, clearAll,
      undoable, undo,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearch(): SearchValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSearch must be inside SearchProvider");
  return v;
}
