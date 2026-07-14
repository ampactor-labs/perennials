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
import { sourceFor } from "./db.mjs";

// A closed set. An open `?w=` would invite thousands of variants of the same photo
// into the cache, and it would make this an open image proxy besides.
//
// It stops at 800 because that is where the source stops. Permapeople serves two
// images per plant: `thumb` at 300px and `title` at 800px on the long edge. The
// pipeline used to read only `thumb`, which is why the plant page looked soft —
// a 300px photo was being stretched across the width of the screen. We resize
// from the 800px one now, at every size, and never past it.
export const WIDTHS = [64, 128, 192, 300, 400, 600, 800];

const UA = "perennials-images/1.0 (+https://ampactor.dev/perennials)";
const MAX_CACHE_BYTES = 160 * 1024 * 1024;

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
  const url = await sourceFor(id);
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
    // A downscale loses a little acutance and a light unsharp puts it back. This
    // used to be heavier on small sizes, which was right when everything came from
    // a 300px source. From 800px a card thumb is a 4x downscale, not a 1.5x one, so
    // the extra sharpening only manufactured high-frequency detail that a 56-pixel
    // box cannot show — and charged her the bytes for it. Measured at 192px:
    // q90/0.7 was 27.8 KB, q82/0.4 is 16.7 KB and looks identical at display size.
    .sharpen({ sigma: 0.45 })
    .webp({ quality: small ? 82 : 80, effort: 4, smartSubsample: true })
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

/**
 * Drop every rendered image.
 *
 * A source refresh can change which origin a plant resizes from — that is exactly
 * what just happened when the pipeline learned to read Permapeople's 800px image —
 * and without this the resizer keeps serving renders made from the old, smaller
 * source forever, because the cache is keyed on plant and width alone.
 */
export function clearImages() {
  cache.clear();
  cacheBytes = 0;
}

export const imageStats = () => ({
  cached: cache.size,
  mb: +(cacheBytes / 1e6).toFixed(1),
  widths: WIDTHS,
});
