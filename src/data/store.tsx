// Loads the static snapshot once, caches it (the service worker handles offline),
// and holds it in memory with a prebuilt text index. No runtime calls to any
// plant API — the data ships as versioned static files under /data.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import MiniSearch from "minisearch";
import type { Facets, Meta, Plant } from "./model";

export type Dataset = {
  plants: Plant[];
  facets: Facets;
  meta: Meta;
  bySlug: Map<string, Plant>;
  byId: Map<number, Plant>;
  index: MiniSearch;
};

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: Dataset };

const Ctx = createContext<State>({ status: "loading" });
const BASE = import.meta.env.BASE_URL;

async function getJson(path: string) {
  const res = await fetch(`${BASE}data/${path}`);
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

        const bySlug = new Map(plants.map((p) => [p.slug, p]));
        const byId = new Map(plants.map((p) => [p.id, p]));
        const index = new MiniSearch({
          fields: ["name", "scientificName", "family"],
          storeFields: ["slug"],
          searchOptions: { prefix: true, fuzzy: 0.2, boost: { name: 3, scientificName: 2 } },
        });
        index.addAll(
          plants.map((p) => ({
            id: p.id,
            name: p.name,
            scientificName: p.scientificName,
            family: p.family ?? "",
            slug: p.slug,
          })),
        );
        setState({ status: "ready", data: { plants, facets, meta, bySlug, byId, index } });
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
