// Everything she has written, in one file, and the way back in.
//
// The text export in KeptPage was the paper way out: readable forever, and
// lossy. It carried her kept list and her notes and dropped her yards, her
// spots, her bloom dates, her zone and every value she filled in herself, and
// it could not be read back at all. A backup you cannot restore is a printout.
//
// So there are two files now, and they are not competing. The .json round-trips
// everything, including her photos, and it is the one this app can read. The
// .txt is still the thing that outlives the app: no format, no parser, no
// version. She should have both, which is why "Save a copy" writes both.
//
// The photos ride inside the JSON as data URLs. It makes the file big, and the
// alternative is a zip (no browser primitive builds one) or a second file she
// has to keep next to the first (the failure mode is losing it). One file that
// restores completely beats two that mostly do.
import type { Dataset } from "@/data/store";
import { readZone, writeZone } from "./homeZone";
import { readKept, writeKept, type Kept } from "./kept";
import { readLat, writeLat } from "./latitude";
import { MINE_FIELDS, readMine, writeMine, type Mine, type MineField } from "./mine";
import { noteDate, readNotes, writeNotes, type Note } from "./notes";
import { blobToDataUrl, getPhoto, restorePhoto } from "./photos";
import { readSeen, writeSeen, type Seen } from "./seen";
import { readTheme, writeTheme, type ThemePref } from "./settings";
import { readSpots, writeSpots, type Spot } from "./spots";
import { readYards, writeYards, type Yard } from "./yards";

export const BACKUP_FORMAT = "perennials-backup";

export type Backup = {
  format: typeof BACKUP_FORMAT;
  v: 1;
  at: string;
  kept: Kept[];
  notes: Note[];
  seen: Seen[];
  spots: Spot[];
  yards: Yard[];
  mine: Mine[];
  zone: number | null;
  /** Her latitude, whole degrees, for the sun. Old backups carry none. */
  lat: number | null;
  theme: ThemePref | null;
  /** photo key -> data URL. Only the ones her stores actually point at: mine
   *  records, and the ground under a yard. */
  photos: Record<string, string>;
};

/** What a restore did, so the page can tell her rather than claiming success. */
export type Restored = {
  kept: number;
  notes: number;
  seen: number;
  spots: number;
  yards: number;
  mine: number;
  photos: number;
  /** A store localStorage refused. The session holds it and the disk does not,
   *  which is the one restore outcome that looks exactly like success. */
  refused: boolean;
};

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/* ---- out ------------------------------------------------------------- */

/** Every photo key her stores point at: her plant photos, and the ground under
 *  each yard. The backup must carry exactly these, and each of them once; this
 *  is a pure function because rules.test.ts pins that. */
export function photoKeys(mine: Mine[], yards: Yard[]): string[] {
  const keys = mine.filter((m) => m.field === "photo").map((m) => m.text);
  for (const y of yards) if (y.underlay) keys.push(y.underlay);
  return [...new Set(keys)];
}

/**
 * Read every store, and every photo those stores point at.
 *
 * A record whose blob has been evicted is kept and its photo is skipped: the
 * record is still hers, and exporting a key with no image behind it is how
 * you get an import that looks fine and shows a hole.
 */
export async function buildBackup(): Promise<Backup> {
  const mine = readMine();
  const yards = readYards();
  const photos: Record<string, string> = {};
  for (const key of photoKeys(mine, yards)) {
    const blob = await getPhoto(key);
    if (blob) photos[key] = await blobToDataUrl(blob);
  }
  return {
    format: BACKUP_FORMAT,
    v: 1,
    at: new Date().toISOString(),
    kept: readKept(),
    notes: readNotes(),
    seen: readSeen(),
    spots: readSpots(),
    yards,
    mine,
    zone: readZone(),
    lat: readLat(),
    theme: readTheme(),
    photos,
  };
}

/** How much is in here, for a line she can read before she trusts it. */
export function countOf(b: Backup): Restored {
  return {
    kept: b.kept.length,
    notes: b.notes.length,
    seen: b.seen.length,
    spots: b.spots.length,
    yards: b.yards.length,
    mine: b.mine.length,
    photos: Object.keys(b.photos).length,
    refused: false,
  };
}

/* ---- in -------------------------------------------------------------- */

/** Reject anything that isn't ours before it touches a store. A wrong file
 *  picked out of a Downloads folder must bounce, not half-import. */
export function parseBackup(text: string): Backup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const b = raw as Backup;
  if (b?.format !== BACKUP_FORMAT || b?.v !== 1) return null;
  const fields = new Set<string>(MINE_FIELDS);
  return {
    format: BACKUP_FORMAT,
    v: 1,
    at: typeof b.at === "string" ? b.at : "",
    kept: asArray<Kept>(b.kept).filter((k) => typeof k?.id === "number"),
    notes: asArray<Note>(b.notes).filter(
      (n) => typeof n?.id === "number" && typeof n?.text === "string",
    ),
    seen: asArray<Seen>(b.seen).filter(
      (s) => typeof s?.id === "number" && typeof s?.at === "number",
    ),
    spots: asArray<Spot>(b.spots).filter((s) => typeof s?.id === "string"),
    yards: asArray<Yard>(b.yards).filter((y) => typeof y?.id === "string"),
    mine: asArray<Mine>(b.mine).filter(
      (m) =>
        typeof m?.id === "number" &&
        typeof m?.text === "string" &&
        fields.has(m?.field as MineField),
    ),
    zone: typeof b.zone === "number" ? b.zone : null,
    lat: typeof b.lat === "number" ? b.lat : null,
    theme:
      b.theme === "light" || b.theme === "dark" || b.theme === "system" ? b.theme : null,
    photos:
      b.photos && typeof b.photos === "object"
        ? Object.fromEntries(
            Object.entries(b.photos).filter(
              ([k, v]) => typeof k === "string" && typeof v === "string",
            ),
          )
        : {},
  };
}

const dataUrlToBlob = async (url: string): Promise<Blob> => (await fetch(url)).blob();

export type Mode = "merge" | "replace";

/**
 * Union two stores by identity, newest entry winning.
 *
 * This is the whole restore, and the only part of it that can lose her work, so
 * it is a pure function with the rules pinned in rules.test.ts rather than a
 * closure buried in an async that touches four kinds of storage.
 *
 * Merge is the default because the realistic restore is her second device: she
 * has notes here, notes there, and a "restore" that wipes the ones on the phone
 * she is holding is a data-loss bug wearing a feature's clothes. Every store has
 * a natural identity (a plant id, a plant id + field, a yard id), so the union is
 * well defined. Where both sides carry the same identity, the later `at` wins.
 *
 * `>=` and not `>`: with equal timestamps the incoming copy wins. The tie only
 * happens when both sides hold the same entry, so either answer is the same
 * answer, and picking one keeps the result independent of read order.
 */
export function mergeById<T>(
  mine: T[],
  theirs: T[],
  id: (v: T) => string,
  at: (v: T) => number,
  mode: Mode,
): T[] {
  if (mode === "replace") return theirs;
  const out = new Map(mine.map((v) => [id(v), v]));
  for (const t of theirs) {
    const have = out.get(id(t));
    if (!have || at(t) >= at(have)) out.set(id(t), t);
  }
  return [...out.values()];
}

/**
 * Write a backup into this phone's stores.
 *
 * Every write goes through the store that owns the key, never through
 * localStorage. That is the whole reason this returns without asking anyone to
 * reload: `createLocalStore.write` refreshes the store's cache and pokes its
 * subscribers, so the kept list, the notes, the bloom calendar, the yards, the
 * theme and the home-zone sort all re-render on the spot. Writing the keys raw
 * left sixteen `useSyncExternalStore` readers holding a stale cache, and a
 * reload was the only thing that could dig them out.
 */
export async function restoreBackup(b: Backup, mode: Mode): Promise<Restored> {
  const mergeBy = <T,>(mine: T[], theirs: T[], id: (v: T) => string, at: (v: T) => number): T[] =>
    mergeById(mine, theirs, id, at, mode);

  const kept = mergeBy(readKept(), b.kept, (k) => String(k.id), (k) => k.at ?? 0);
  const notes = mergeBy(readNotes(), b.notes, (n) => String(n.id), (n) => n.at ?? 0);
  // A bloom mark is a (plant, day) fact, not a value that gets superseded, so
  // identity is the pair and a merge is a plain union. Two phones marking the
  // same plant on the same day is one observation, not two.
  const seen = mergeBy(
    readSeen(),
    b.seen,
    (s) => `${s.id}:${new Date(s.at).toDateString()}`,
    (s) => s.at ?? 0,
  );
  const spots = mergeBy(readSpots(), b.spots, (s) => s.id, () => 0);
  const yards = mergeBy(readYards(), b.yards, (y) => y.id, (y) => y.at ?? 0);
  const mine = mergeBy(readMine(), b.mine, (m) => `${m.id}:${m.field}`, (m) => m.at ?? 0);

  // Photos first: a mine record pointing at a blob that isn't in yet renders as
  // a hole for however long the write takes.
  let photos = 0;
  for (const [key, url] of Object.entries(b.photos)) {
    try {
      await restorePhoto(key, await dataUrlToBlob(url));
      photos++;
    } catch {
      /* one unreadable image must not abandon the rest of the restore */
    }
  }

  // Every store's write says whether the disk took it. A restore that lands in
  // the session and not on disk is the failure that looks most like success, so
  // it is collected rather than caught and dropped.
  const ok = [
    writeKept(kept),
    writeNotes(notes),
    writeSeen(seen),
    writeSpots(spots),
    writeYards(yards),
    writeMine(mine),
    b.zone === null || writeZone(b.zone),
    b.lat === null || writeLat(b.lat),
    b.theme === null || writeTheme(b.theme),
  ];

  return {
    kept: kept.length,
    notes: notes.length,
    seen: seen.length,
    spots: spots.length,
    yards: yards.length,
    mine: mine.length,
    photos,
    refused: ok.some((v) => v === false),
  };
}

/* ---- the paper copy -------------------------------------------------- */

const FIELD_LABEL: Record<MineField, string> = {
  bloomColor: "Bloom colour",
  light: "Light",
  water: "Water",
  soil: "Soil",
  layer: "Layer",
  lifeCycle: "Life cycle",
  growth: "Growth",
  height: "Height",
  width: "Width",
  hardiness: "Hardiness",
  attracts: "Flower visitors",
  edibleParts: "Edible parts",
  nativeTo: "Native to",
  functions: "Functions",
  photo: "Photo",
};

/**
 * The paper backup: everything she wrote, in the order a person reads.
 *
 * Plain text is the only format guaranteed to outlive the app, and this is the
 * copy that has to still make sense in ten years with no parser and no guide.
 * It names every plant it can resolve and says so plainly when it can't, rather
 * than printing a bare id at someone holding a sheet of paper.
 */
export function backupText(data: Dataset | null, b: Backup): string {
  const name = (id: number) => {
    const p = data?.byId.get(id);
    return p ? `${p.name} — ${p.scientificName}` : `Plant #${id} (not in this copy of the guide)`;
  };
  const noteFor = (id: number) => b.notes.find((n) => n.id === id);
  const seenFor = (id: number) => b.seen.filter((s) => s.id === id).sort((a, c) => a.at - c.at);
  const mineFor = (id: number) => b.mine.filter((m) => m.id === id && m.field !== "photo");
  const hasPhoto = (id: number) => b.mine.some((m) => m.id === id && m.field === "photo");

  const touched = [
    ...b.kept.map((k) => k.id),
    ...b.notes.map((n) => n.id),
    ...b.seen.map((s) => s.id),
    ...b.mine.map((m) => m.id),
  ];
  const keptIds = new Set(b.kept.map((k) => k.id));
  const seenOrder: number[] = [];
  for (const id of touched) if (!seenOrder.includes(id)) seenOrder.push(id);

  const entry = (id: number) => {
    const n = noteFor(id);
    const days = seenFor(id);
    const vals = mineFor(id);
    return [
      name(id),
      n ? `  ${n.text.replace(/\n/g, "\n  ")}  (${noteDate(n.at)})` : null,
      days.length ? `  Seen in bloom: ${days.map((s) => noteDate(s.at)).join(", ")}` : null,
      ...vals.map((m) => `  ${FIELD_LABEL[m.field]} (yours): ${m.text}`),
      hasPhoto(id) ? "  Your photo: in the .json backup" : null,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const kept = seenOrder.filter((id) => keptIds.has(id));
  const rest = seenOrder.filter((id) => !keptIds.has(id));

  const out = [
    `Perennials · everything you've written · ${new Date(b.at || Date.now()).toLocaleDateString()}`,
    "",
    `KEPT (${kept.length})`,
    ...kept.map(entry),
  ];
  if (rest.length) out.push("", `WRITTEN ON, NOT KEPT (${rest.length})`, ...rest.map(entry));

  if (b.spots.length) {
    out.push("", `SPOTS (${b.spots.length})`);
    for (const s of b.spots) {
      const cond = Object.entries(s.facets)
        .map(([k, v]) => `${k}: ${v.join(", ")}`)
        .join("; ");
      out.push(`${s.name}${s.zone !== null ? ` · zone ${s.zone}` : ""}${cond ? ` · ${cond}` : ""}`);
    }
  }

  if (b.yards.length) {
    out.push("", `YARDS (${b.yards.length})`);
    for (const y of b.yards) {
      out.push(
        `${y.name} · ${y.plants.length} placed · ${y.strokes.length} drawn${y.underlay ? " · your photo under it" : ""}`,
      );
      for (const pl of y.plants) out.push(`  ${pl.name}${pl.r ? ` (ring ${pl.r})` : ""}`);
    }
  }

  out.push(
    "",
    `Home zone: ${b.zone ?? "not set"}`,
    "",
    "The .json backup beside this file restores all of it, photos included.",
  );
  return out.join("\n") + "\n";
}
