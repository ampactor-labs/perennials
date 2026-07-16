import type { Hardiness } from "@/data/model";

/**
 * What a hardiness record actually says.
 *
 * A bare number is a cold-hardiness FLOOR. "USDA Hardiness zone: 5" means the
 * plant survives zone 5 winters, so it survives zone 6 too; it has never meant
 * "zone 5 and nowhere else". server/src/transform.mjs only builds a range when
 * the source string carries a dash, and it used to fabricate `max` from a lone
 * number: Chokecherry's "1" became {min:1, max:1}, which the zone filter then
 * read as "dies in zone 6" and dropped out of her search entirely. An invented
 * bound, printed as a fact about the plant, which is the one thing this app
 * does not do.
 *
 * The transform now writes `max: null` for a lone number. The degenerate
 * min === max that older data still carries means the same thing (no plant is
 * hardy in exactly one zone), so both read as "nobody recorded a top" and only
 * the floor is testable.
 */
const topless = (h: Hardiness) => h.max === null || h.max === h.min;

/** Does the record say it survives that zone? Never a guess: with no recorded
 *  top, only the floor is asked. */
export const hardyIn = (h: Hardiness, zone: number): boolean =>
  zone >= h.min && (topless(h) || zone <= h.max!);

/** "5–9", or "5+" where the source gave a floor and no top. */
export const hardinessLabel = (h: Hardiness): string =>
  topless(h) ? `${h.min}+` : `${h.min}–${h.max}`;
