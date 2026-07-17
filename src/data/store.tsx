// Loads the dataset once from the hosted API (see server/), holds it in memory
// with a prebuilt text index; the service worker caches the responses for
// offline. No third-party plant API is ever called from the browser.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import MiniSearch from "minisearch";
import { hardyBand, useHomeZone } from "@/lib/homeZone";
import type { Facets, Meta, Plant } from "./model";

export type Dataset = {
  plants: Plant[];
  facets: Facets;
  meta: Meta;
  bySlug: Map<string, Plant>;
  byId: Map<number, Plant>;
  /** The name index. Built on first use, not on load; see makeDataset. */
  readonly index: MiniSearch;
};

type Raw = { plants: Plant[]; facets: Facets; meta: Meta };

/**
 * The lazy text index, built once per payload and NOT on load.
 *
 * The index takes an 8,800-document pass, which is half a second of frozen main
 * thread on a phone, paid on every cold launch, including a fully offline one in
 * the garden where the service worker hands over the bytes instantly. And it is
 * needed only when she types a name, which is the thing she does least.
 *
 * So: build it when the browser next goes idle, and if she somehow types before
 * that, the getter builds it on the spot. Either way the guide is on screen first.
 *
 * It lives outside makeDataset because the dataset is now re-assembled when her
 * home zone changes (a re-sort) and the index does not care about order; losing
 * it to a re-sort would charge her the half second again for nothing.
 */
function makeIndexBuilder(plants: Plant[]): () => MiniSearch {
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
  return build;
}

/**
 * Assemble the dataset in the order the guide opens in.
 *
 * The server ships plants sorted by documentation richness, which is a global
 * signal with no regional pull: a tropical that dies in her winter outranked a
 * serviceberry whenever contributors wrote more about it. Banding by her home
 * zone puts plants that can live where she gardens first, the unmeasured in the
 * middle, and the recorded misfits last; the sort is stable, so within each band
 * the richness order still decides. Nothing is hidden: it is an order, not a
 * filter, and evaluate() inherits it for free, since results are pushed in
 * dataset order whenever no text search outranks it.
 */
function makeDataset(raw: Raw, zone: number, buildIndex: () => MiniSearch): Dataset {
  const plants = [...raw.plants].sort((a, b) => hardyBand(a, zone) - hardyBand(b, zone));
  return {
    plants,
    facets: raw.facets,
    meta: raw.meta,
    bySlug: new Map(plants.map((p) => [p.slug, p])),
    byId: new Map(plants.map((p) => [p.id, p])),
    get index() {
      return buildIndex();
    },
  };
}

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: Dataset };

/** What the fetch produced, before the home zone has had its say on the order. */
type Phase =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; raw: Raw };

const Ctx = createContext<State>({ status: "loading" });
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
 * Cache Storage, so she could open the guide at home, watch it work, drive to a
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

  // Read the body ONCE, then cache those bytes and parse those same bytes.
  //
  // The obvious version, `cache.put(url, res.clone())` followed by `res.json()`,
  // does not work here and fails in the worst possible way. Cloning a Response tees
  // its stream, and with three of these in flight at once Chrome cannot keep the
  // 8.9 MB branch fed: put() rejects with "Cache.put() encountered a network error"
  // for plants.json while quietly succeeding for facets.json and meta.json. The
  // guide then looked cached, and offline still worked, because the browser's own
  // HTTP cache was covering for it. An hour later that entry goes stale and the
  // garden gets an empty app. No clone, no tee, no problem.
  const bytes = await res.arrayBuffer();

  if ("caches" in window) {
    try {
      const cache = await caches.open(DATA_CACHE);
      await cache.put(url, new Response(bytes, { headers: { "Content-Type": "application/json" } }));
    } catch (e) {
      // A full disk, or a private window. She still gets the guide this session;
      // she just does not get it offline. Say so, rather than swallowing it: a
      // silent failure here is indistinguishable from success until she is in a
      // field with no signal.
      console.error(`could not save ${path} for offline use:`, e);
    }
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  const zone = useHomeZone();

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
        setPhase({ status: "ready", raw: { plants, facets, meta } });

        // Now there is something worth keeping, ask the browser to keep it.
        // Without this, the app shell and the guide sit in the evictable bucket and
        // Chrome is free to drop them under storage pressure, which, for a field
        // guide, means it stops being one. An installed Android PWA with engagement
        // is granted this silently, so it costs her no prompt.
        void navigator.storage?.persist?.().catch(() => {});
      } catch (err) {
        if (!cancelled) setPhase({ status: "error", error: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // One index per payload; one dataset per (payload, home zone). A zone change
  // re-sorts and rebuilds two Maps (rare and cheap) but never re-indexes.
  const buildIndex = useMemo(
    () => (phase.status === "ready" ? makeIndexBuilder(phase.raw.plants) : null),
    [phase],
  );
  const state = useMemo<State>(() => {
    if (phase.status !== "ready" || !buildIndex) {
      return phase.status === "ready"
        ? { status: "loading" } // unreachable: buildIndex exists whenever phase is ready
        : phase;
    }
    return { status: "ready", data: makeDataset(phase.raw, zone, buildIndex) };
  }, [phase, zone, buildIndex]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useDataState = () => useContext(Ctx);
