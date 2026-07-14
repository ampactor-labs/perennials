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
  if (!has || failed) {
    return (
      <span className={fallbackClass} aria-hidden="true">
        ✿
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
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
