// Years as an axis: how much of a recorded mature height stands at year N.
//
// The record gives a pace in three words (slow, moderate, fast) and a mature
// size; it does not give a curve. So the curve here is a band, not a line:
// a fast reading and a slow reading of the same word, and the honest answer
// is "somewhere between". A plant whose pace the sources never recorded gets
// null, and the caller draws it at maturity with the gap said out loud,
// because guessing a pace would move her plants for a reason nobody gave.
export type GrowthBand = { lo: number; hi: number };

/** Years to reach roughly mature height, by the record's word. Horticultural
 *  rules of thumb, not measurements, which is exactly why the band exists. */
const YEARS_TO_MATURE: Record<string, number> = {
  slow: 20,
  moderate: 12,
  medium: 12,
  fast: 7,
};

/** Saturating approach to mature size: 95% at T years, monotonic, no
 *  overshoot. The shape is a convention; the band carries the uncertainty. */
const ramp = (years: number, T: number): number =>
  years <= 0 ? 0 : 1 - Math.exp((-3 * years) / T);

export function growthBand(
  growth: string | null | undefined,
  years: number,
): GrowthBand | null {
  if (!growth) return null;
  const word = growth.toLowerCase();
  const T = Object.entries(YEARS_TO_MATURE).find(([k]) => word.includes(k))?.[1];
  if (T === undefined) return null;
  // The same word read generously and read cautiously.
  return { lo: ramp(years, T * 1.4), hi: ramp(years, T * 0.7) };
}
