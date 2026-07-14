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
      // altNames is why she can type "mouse melon" and find Melothria scabra.
      // Nearly half the catalogue carries a common-name synonym, and none of them
      // were searchable until now.
      fields: ["name", "altNames", "scientificName", "family"],
      storeFields: ["slug"],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { name: 3, altNames: 3, scientificName: 2 },
      },
    });
    mini.addAll(
      plants.map((p) => ({
        id: p.id,
        name: p.name,
        altNames: (p.altNames ?? []).join(" "),
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
  /** `cold` is true only when the guide is not on this phone yet — it decides
   *  whether the gate is allowed to say it is downloading anything. */
  | { status: "loading"; cold: boolean }
  | { status: "error"; error: string }
  | { status: "ready"; data: Dataset };

const Ctx = createContext<State>({ status: "loading", cold: false });
// The dataset comes from the hosted API (see server/). Set VITE_DATA_API to point
// at a different backend for local work; keep the URL in sync with the
// service-worker cache rule in vite.config.ts.
export const DATA_BASE = import.meta.env.VITE_DATA_API || "https://api-production-5338.up.railway.app/data";

/** The cache the service worker reads from. Must match vite.config.ts's data route. */
const DATA_CACHE = "perennials-data";

/**
 * Fetch a payload, and save it ourselves.
 *
 * The saving is the whole point, and it is not redundant with the service worker.
 * These three fetches fire from DataProvider's mount effect at about t=90ms; the
 * service worker does not claim the page until about t=460ms. On a first visit
 * the responses therefore never pass through the Workbox route and never land in
 * Cache Storage — so she could open the guide at home, watch it work, drive to a
 * field with no signal, and find an empty app telling her to "open it once where
 * there's signal", which is precisely what she had done.
 *
 * The photos hid this: they are loading="lazy", so they fire after the claim and
 * cache correctly on the first visit. Only the data lost the race, and the data
 * is the guide.
 *
 * Writing to the same named cache the SW owns means its StaleWhileRevalidate route
 * picks these entries up and revalidates them from then on. No new cache, no new
 * config, and the first visit is now enough.
 */
async function getJson(path: string) {
  const url = `${DATA_BASE}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);

  if ("caches" in window) {
    try {
      const cache = await caches.open(DATA_CACHE);
      await cache.put(url, res.clone());
    } catch {
      // A full disk or a private window. She still gets the guide this session;
      // she just doesn't get it offline, which is the state we were already in.
    }
  }
  return res.json();
}

/** Is the guide already on this phone? Must be asked before the fetch — afterwards
 *  the answer is always yes. */
async function alreadySaved() {
  if (!("caches" in window)) return false;
  try {
    const cache = await caches.open(DATA_CACHE);
    return !!(await cache.match(`${DATA_BASE}/plants.json`));
  } catch {
    return false;
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading", cold: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cold = !(await alreadySaved());
      if (cancelled) return;
      if (cold) setState({ status: "loading", cold: true });

      try {
        const [plants, facets, meta] = (await Promise.all([
          getJson("plants.json"),
          getJson("facets.json"),
          getJson("meta.json"),
        ])) as [Plant[], Facets, Meta];
        if (cancelled) return;
        setState({ status: "ready", data: makeDataset(plants, facets, meta) });

        // Now there is something worth keeping, ask the browser to keep it.
        // Without this, the app shell and the guide sit in the evictable bucket and
        // Chrome is free to drop them under storage pressure — which, for a field
        // guide, means it stops being one. An installed Android PWA with engagement
        // is granted this silently, so it costs her no prompt.
        void navigator.storage?.persist?.().catch(() => {});
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
