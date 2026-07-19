// Her photos, in IndexedDB, because they cannot live where the rest of her data
// lives.
//
// Everything else she writes is a few hundred bytes and goes in localStorage.
// A photo off a phone camera is 2-4MB, and the whole origin gets about 5MB of
// localStorage. One snap would blow the budget and take her notes, her kept list
// and her yard plans down with it, because localStorage fails the *write* when
// it is full and the caller has no way to make room. So photos go to IndexedDB,
// which is bounded by disk rather than by a 5MB ceiling, and localStorage keeps
// only the key.
//
// They are downscaled first. She wants a record of the plant, not the sensor:
// 1400px on the long edge is more than the detail figure can show (~984 real
// pixels on her phone) and lands around 200KB, so a hundred photos still fit in
// a quota the browser will actually grant.
import { useEffect, useState } from "react";

const DB = "perennials-photos";
const SHELF = "photos";
const MAX_EDGE = 1400;
const QUALITY = 0.82;

let handle: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (handle) return handle;
  handle = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(SHELF)) req.result.createObjectStore(SHELF);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // A failed open must not be cached, or every later call replays the failure.
  handle.catch(() => {
    handle = null;
  });
  return handle;
}

/**
 * One request in one transaction.
 *
 * `run` may not await: an IndexedDB transaction auto-closes at the end of the
 * microtask that has no live request, so a value awaited inside the callback
 * lands on a dead handle. Every caller resolves its blob before calling in.
 */
async function tx<T>(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(SHELF, mode).objectStore(SHELF));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Downscale to something a phone can hold a hundred of.
 *
 * Read through createImageBitmap with `imageOrientation: "from-image"`, which
 * applies EXIF rotation. A portrait snap drawn to a canvas without it comes out
 * on its side, and she would have no way to fix it.
 */
async function shrink(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  // A canvas that refuses to encode is no reason to lose her photo; the original
  // is a perfectly good image, only a heavier one.
  return out ?? file;
}

const newKey = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** A photo as text, for the backup file and the exported sheet. */
export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });

/** Store a photo, returning the key that goes in the mine store. Throws when the
 *  quota says no, so the caller can tell her rather than dropping it silently. */
export async function putPhoto(file: Blob): Promise<string> {
  const blob = await shrink(file);
  const key = newKey();
  await tx("readwrite", (s) => s.put(blob, key));
  return key;
}

export async function getPhoto(key: string): Promise<Blob | undefined> {
  try {
    return await tx<Blob | undefined>("readonly", (s) => s.get(key));
  } catch {
    return undefined;
  }
}

export async function deletePhoto(key: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(key));
  } catch {
    /* already gone, or the db never opened; nothing to clean up */
  }
}

/** Put a photo back under the key it had, for the importer. */
export async function restorePhoto(key: string, blob: Blob): Promise<void> {
  await tx("readwrite", (s) => s.put(blob, key));
}

/**
 * A live URL for one of her photos, or null.
 *
 * An object URL is a handle into this document and stays alive until it is
 * revoked; leaking one keeps the whole decoded image in memory for the life of
 * the tab, and this runs in a grid, so leaking is not theoretical. Every URL is
 * revoked when the key changes or the card unmounts, and a resolve that lands
 * after unmount is dropped rather than assigned.
 */
export function useMinePhoto(key: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }
    let dead = false;
    let made: string | null = null;
    void getPhoto(key).then((blob) => {
      if (dead || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      dead = true;
      setUrl(null);
      if (made) URL.revokeObjectURL(made);
    };
  }, [key]);

  return url;
}
