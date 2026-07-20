// A yard that travels: one file a designer hands a client so their phone
// becomes that yard's guide.
//
// The full backup (lib/backup.ts) round-trips everything she has ever written.
// This is the single-yard cousin, for the realistic hand-off: a client gets
// one garden, not the designer's whole notebook. It mirrors backup.ts on every
// point that matters — a strict parse that bounces a wrong file rather than
// half-importing it, the photo carried inside the JSON as a data URL so there
// is one file and not two, and the yard admitted through writeYards so its
// subscribers re-render on the spot.
//
// The one rule this file adds is that an import may never cost her a yard she
// already has. A yard she opens carries the id it was saved with, which can
// collide with one already on her phone; admitYard gives the newcomer a fresh
// id instead of letting it overwrite, because the yard on the phone she is
// holding is the one that cannot be replaced by a file from someone else.
import { restorePhoto, blobToDataUrl, getPhoto } from "./photos";
import { readYards, sanitizeYard, writeYards, type Yard } from "./yards";

export const YARD_FORMAT = "perennials-yard";

export type YardFile = {
  format: typeof YARD_FORMAT;
  v: 1;
  at: string;
  yard: Yard;
  /** photo key -> data URL. Only the ground under this yard, when it has one. */
  photos: Record<string, string>;
};

const freshKey = (prefix: string, now: number): string =>
  prefix + now.toString(36) + Math.random().toString(36).slice(2, 7);

const dataUrlToBlob = async (url: string): Promise<Blob> => (await fetch(url)).blob();

/* ---- out ------------------------------------------------------------- */

/** Read one yard and the ground under it into a portable file. A missing blob
 *  skips the photo, never fails the file: exporting a key with no image behind
 *  it is how you get an import that looks fine and shows a hole. */
export async function buildYardFile(yard: Yard): Promise<YardFile> {
  const photos: Record<string, string> = {};
  if (yard.underlay) {
    const blob = await getPhoto(yard.underlay);
    if (blob) photos[yard.underlay] = await blobToDataUrl(blob);
  }
  return { format: YARD_FORMAT, v: 1, at: new Date().toISOString(), yard, photos };
}

export const yardFileText = (f: YardFile): string => JSON.stringify(f, null, 2);

/* ---- in -------------------------------------------------------------- */

/** Reject anything that isn't one of ours before it touches a store, and run
 *  the yard through the same sanitizer a restore uses, so a hand-edited or
 *  wrong file bounces rather than half-importing. */
export function parseYardFile(text: string): YardFile | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const f = raw as YardFile;
  if (f?.format !== YARD_FORMAT || f?.v !== 1) return null;
  const yard = sanitizeYard(f.yard);
  if (!yard) return null;
  const photos =
    f.photos && typeof f.photos === "object"
      ? Object.fromEntries(
          Object.entries(f.photos).filter(
            ([k, v]) => typeof k === "string" && typeof v === "string",
          ),
        )
      : {};
  return { format: YARD_FORMAT, v: 1, at: typeof f.at === "string" ? f.at : "", yard, photos };
}

/**
 * Add an incoming yard to the ones she has, never overwriting.
 *
 * Pure, so the rule that an import cannot cost her a yard is pinned in
 * rules.test.ts rather than buried in an async that touches storage. On an id
 * collision the newcomer takes freshId and every existing yard is left exactly
 * as it was; with no collision it keeps its own id. Either way the result holds
 * every yard she had plus the one that arrived.
 */
export function admitYard(existing: Yard[], incoming: Yard, freshId: string): Yard[] {
  const clash = existing.some((y) => y.id === incoming.id);
  return [...existing, clash ? { ...incoming, id: freshId } : incoming];
}

/**
 * Import a yard file into this phone's store.
 *
 * The ground is always re-keyed under a fresh IndexedDB key before it is
 * written: the file's key was minted on another phone and could name a
 * different photo here, so writing the blob under it would either collide with
 * one of hers or leave the yard pointing at someone else's image. An unreadable
 * or absent ground costs the yard its backdrop, never the yard. Returns what
 * arrived so the page can say it, or null on a bounced file.
 */
export async function importYardFile(
  text: string,
  now: number,
): Promise<{ name: string; plants: number; saved: boolean } | null> {
  const f = parseYardFile(text);
  if (!f) return null;
  let yard: Yard = { ...f.yard, at: now };

  if (yard.underlay) {
    const dataUrl = f.photos[yard.underlay];
    let landed = false;
    if (dataUrl) {
      try {
        const key = freshKey("y", now);
        await restorePhoto(key, await dataUrlToBlob(dataUrl));
        yard = { ...yard, underlay: key };
        landed = true;
      } catch {
        /* unreadable image: fall through and drop the dangling ground */
      }
    }
    if (!landed) {
      const { underlay: _drop, ...rest } = yard;
      yard = rest;
    }
  }

  // writeYards says whether the disk took it. A client importing a plan into
  // a full phone that is told "Opened" while nothing persisted is the silent
  // loss the rest of the app refuses, so the flag rides back to the page.
  const existing = readYards();
  const saved = writeYards(admitYard(existing, yard, freshKey("y", now)));
  return { name: yard.name, plants: yard.plants.length, saved };
}
