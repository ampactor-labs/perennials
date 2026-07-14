// Loads the dataset once from the hosted API (see server/), holds it in memory
// with a prebuilt text index; the service worker caches the responses for
// offline. No third-party plant API is ever called from the browser.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import MiniSearch from "minisearch";
import type { Facets, Meta, Plant } from "./model";

export type Dataset = {
  plants: Plant[];
  facets: Facets;
  meta: Meta;
  bySlug: Map<string, Plant>;
  byId: Map<number, Plant>;
  /** The name index. Built on first use, not on load — see makeDataset. */
  readonly index: MiniSearch;
};

/**
 * Assemble the dataset, and do NOT build the text index yet.
 *
 * The index takes an 8,800-document pass, which is half a second of frozen main
 * thread on a phone — paid on every cold launch, including a fully offline one in
 * the garden where the service worker hands over the bytes instantly. And it is
 * needed only when she types a name, which is the thing she does least.
 *
 * So: build it when the browser next goes idle, and if she somehow types before
 * that, the getter builds it on the spot. Either way the guide is on screen first.
 */
function makeDataset(plants: Plant[], facets: Facets, meta: Meta): Dataset {
  let index: MiniSearch | null = null;

  const build = () => {
    if (index) return index;
    const mini = new MiniSearch({
      fields: ["name", "scientificName", "family"],
      storeFields: ["slug"],
      searchOptions: { prefix: true, fuzzy: 0.2, boost: { name: 3, scientificName: 2 } },
    });
    mini.addAll(
      plants.map((p) => ({
        id: p.id,
        name: p.name,
        scientificName: p.scientificName,
        family: p.family ?? "",
        slug: p.slug,
      })),
    );
    index = mini;
    return mini;
  };

  const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 200));
  idle(() => build());

  return {
    plants,
    facets,
    meta,
    bySlug: new Map(plants.map((p) => [p.slug, p])),
    byId: new Map(plants.map((p) => [p.id, p])),
    get index() {
      return build();
    },
  };
}

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: Dataset };

const Ctx = createContext<State>({ status: "loading" });
// The dataset comes from the hosted API (see server/). Set VITE_DATA_API to point
// at a different backend for local work; keep the URL in sync with the
// service-worker cache rule in vite.config.ts.
export const DATA_BASE = import.meta.env.VITE_DATA_API || "https://api-production-5338.up.railway.app/data";

async function getJson(path: string) {
  const res = await fetch(`${DATA_BASE}/${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plants, facets, meta] = (await Promise.all([
          getJson("plants.json"),
          getJson("facets.json"),
          getJson("meta.json"),
        ])) as [Plant[], Facets, Meta];
        if (cancelled) return;
        setState({ status: "ready", data: makeDataset(plants, facets, meta) });
      } catch (err) {
        if (!cancelled) setState({ status: "error", error: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useDataState = () => useContext(Ctx);
