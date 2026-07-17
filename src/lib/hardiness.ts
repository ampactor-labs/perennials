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
 * hardy in exactly one zone), so both read as "we have no top" and only
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

/**
 * Her typed hardiness, when it is a hardiness and not a sentence.
 *
 * She fills these blanks in free text, and free text is where a guess would get
 * in. "5" and "5-9" and "zone 5" say something exact; "hardy-ish by the south
 * wall" does not, and the difference decides whether her plant sorts as measured
 * or stays in the band for plants we have no number for. So this parses the forms
 * that mean one thing and returns null for everything else, which leaves her
 * words on the page and out of the sort. Never a guess: that rule is the reason
 * the transform stopped fabricating `max`, and it does not get relaxed because
 * the author changed.
 *
 * A lone number is a floor, by the same rule the record follows above.
 */
export function parseHardiness(text: string): Hardiness | null {
  const s = text.trim().toLowerCase().replace(/^zones?\s+/, "");
  const range = /^(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})$/.exec(s);
  if (range) {
    const min = +range[1];
    const max = +range[2];
    return inZones(min) && inZones(max) && max >= min ? { min, max } : null;
  }
  const floor = /^(\d{1,2})\s*\+?$/.exec(s);
  if (floor && inZones(+floor[1])) return { min: +floor[1], max: null };
  return null;
}

const inZones = (n: number) => Number.isInteger(n) && n >= 1 && n <= 13;
