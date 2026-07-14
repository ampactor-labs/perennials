import { useState } from "react";
import { photoSrc, thumbSrc, PHOTO_SIZES } from "@/lib/img";

/**
 * A plant photo, or the ✿ that means "no photo".
 *
 * Two things it fixes. It asks the server for the size the box actually is —
 * every image in the app used to be the full-resolution original crushed into a
 * 56-pixel square, which cost bytes and still looked soft on a retina screen.
 * And the fallback fires on a failed *fetch*, not only on a missing URL: offline,
 * or once the image cache has evicted a plant, the URL is right there and the
 * request is what fails, so the app used to paint a dead box.
 */
export function Thumb({
  id,
  has,
  alt = "",
  sizes,
  photo = false,
  fallbackClass,
}: {
  id: number;
  /** Whether the guide has a photo for this plant at all. */
  has: boolean;
  alt?: string;
  /** The CSS size of the box, so the browser can pick from the srcset. */
  sizes?: string;
  /** The detail-page photo rather than a small square. */
  photo?: boolean;
  fallbackClass?: string;
}) {
  const [failed, setFailed] = useState(false);

  // Two different facts, and they used to share a glyph. "This plant has no photo
  // in the guide" is an absence in the data; "this one never downloaded" is an
  // absence on this phone, and it is fixed by walking back to signal. She is a
  // professional identifying plants in the field — she is owed the difference.
  if (!has) {
    return (
      <span className={fallbackClass} aria-hidden="true">
        ✿
      </span>
    );
  }
  if (failed) {
    return (
      <span
        className={fallbackClass ? `${fallbackClass} photo-missing` : "photo-missing"}
        title="Photo not downloaded. Open this plant once with signal."
      >
        ⤓
      </span>
    );
  }

  const { src, srcSet } = photo ? photoSrc(id) : thumbSrc(id);
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={photo ? PHOTO_SIZES : sizes}
      alt={alt}
      // Without this the browser fetches no-cors and the service worker stores an
      // OPAQUE response — which Chrome pads by ~7 MB apiece in its storage
      // accounting. Forty-eight photos reported 400 MB, and the cache eventually
      // hit the quota wall and stopped accepting writes entirely, silently, while
      // the photos still rendered online. The API already sends
      // Access-Control-Allow-Origin: *, so this one attribute is the whole fix.
      crossOrigin="anonymous"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
