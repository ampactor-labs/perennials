// Her latitude, to the whole degree, for casting the sun.
//
// A degree of latitude is about 111km: enough to compute solar altitude to
// within a fraction of a degree, and far too coarse to place a house. That is
// the whole bargain, and it is why the rounding happens before the value is
// ever stored: the guide keeps no number more precise than the sun needs.
// Never asked for at load; offered where the sun is, and one tap answers it.
import { useSyncExternalStore } from "react";
import { createLocalStore } from "./localStore";

const store = createLocalStore<number | null>("perennials.lat.v1", null, (raw) =>
  typeof raw === "number" && Number.isFinite(raw) && Math.abs(raw) <= 90 ? Math.round(raw) : null,
);

/** Read and replace, for lib/backup.ts; through the store so a restore pokes
 *  subscribers, the same contract every store keeps. */
export const readLat = store.read;
export const writeLat = (v: number | null): boolean =>
  store.write(v === null ? null : Math.round(v));

export function useLat(): number | null {
  return useSyncExternalStore(store.subscribe, store.read, () => store.empty);
}

/** One tap: where she is standing, rounded before it is kept. Null when the
 *  phone declines or cannot say; the offer stays open, nothing is guessed. */
export function latFromDevice(): Promise<number | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(Math.round(pos.coords.latitude)),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 3600_000 },
    );
  });
}
