import { plants } from "./plants";
import type { HeightBand, LoadedPlant, Plant } from "./types";

/** Primary display band, bucketed by mature max height. */
export function primaryBand(height: Plant["height"]): HeightBand {
  if (height.max <= 2) return "under-2ft";
  if (height.max <= 4) return "2-4ft";
  return "over-4ft";
}

const loaded: LoadedPlant[] = plants
  .map((p) => ({ ...p, heightBand: primaryBand(p.height) }))
  .sort((a, b) => a.commonName.localeCompare(b.commonName));

const byId = new Map(loaded.map((p) => [p.id, p]));

export function allPlants(): LoadedPlant[] {
  return loaded;
}

export function getPlant(id: string): LoadedPlant | undefined {
  return byId.get(id);
}

export const plantCount = loaded.length;
