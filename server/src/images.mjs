// Plant photos, resized.
//
// Permapeople's CDN is a plain S3 bucket behind CloudFront — no image service,
// no resizing. `?width=112` returns the identical bytes. So every 56-pixel
// thumbnail in the app was pulling a full-resolution JPEG (35–95 KB, 58 KB mean)
// and letting the browser crush it down, which is both the largest ongoing
// cellular cost in the guide and, on a phone, not even sharp: a browser
// downscaling a 2000px photo into 56 points loses detail that a proper Lanczos
// pass keeps.
//
// So we resize here, at the exact widths the layout asks for, and hand the phone
// real pixels for its device ratio. WebP at these qualities is visually lossless
// at thumbnail size and roughly a third the bytes of the JPEG it replaces.
import sharp from "sharp";
import { thumbFor } from "./db.mjs";

// A closed set. An open `?w=` would invite 4,000 variants of the same photo into
// the cache, and it would make this an open image proxy besides.
//
// It stops at 300 because that is where the source stops: I sampled the CDN and
// every photo Permapeople serves is exactly 300px on its longest edge. Asking for
// more would hand back the same pixels under a bigger name, which is the blur.
export const WIDTHS = [64, 128, 192, 300];

const UA = "perennials-images/1.0 (+https://ampactor.dev/perennials)";
const MAX_CACHE_BYTES = 96 * 1024 * 1024;

// Insertion-ordered Map doubles as an LRU: re-set on hit to move to the back.
const cache = new Map(); // "id:w" -> { body, etag }
const inFlight = new Map(); // "id:w" -> Promise, so a cold cache under load
let cacheBytes = 0; //          fetches and encodes each image exactly once.

function remember(key, entry) {
  cache.set(key, entry);
  cacheBytes += entry.body.length;
  while (cacheBytes > MAX_CACHE_BYTES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cacheBytes -= cache.get(oldest).body.length;
    cache.delete(oldest);
  }
}

async function render(id, w) {
  const url = await thumbFor(id);
  if (!url) return null;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`origin ${url}: HTTP ${res.status}`);
  const origin = Buffer.from(await res.arrayBuffer());

  const small = w <= 192;
  const body = await sharp(origin)
    .rotate() // honour EXIF orientation before we crop, or portraits come out sideways
    .resize({
      width: w,
      // Never enlarge. Upscaling a small original is exactly how a thumbnail ends
      // up looking soft — better to hand back fewer pixels and let the browser
      // scale a sharp image down than to invent pixels here.
      withoutEnlargement: true,
      fit: "cover",
      position: "attention", // crop toward the interesting part, not the geometric centre
      kernel: "lanczos3",
    })
    // A downscale always loses a little acutance. A light unsharp pass puts it
    // back; heavier on the small sizes, where the loss is greatest.
    .sharpen({ sigma: small ? 0.7 : 0.4 })
    .webp({ quality: small ? 90 : 82, effort: 4, smartSubsample: true })
    .toBuffer();

  return { body, etag: `"${id}-${w}-${body.length.toString(36)}"` };
}

/** Resized WebP for a plant, or null when the guide has no photo for it. */
export async function imageFor(id, w) {
  const key = `${id}:${w}`;

  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // move to the back of the LRU
    cache.set(key, hit);
    return hit;
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = render(id, w)
    .then((entry) => {
      if (entry) remember(key, entry);
      return entry;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, job);
  return job;
}

export const imageStats = () => ({
  cached: cache.size,
  mb: +(cacheBytes / 1e6).toFixed(1),
  widths: WIDTHS,
});
