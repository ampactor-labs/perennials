import { useState } from "react";

/**
 * A plant photo, or the ✿ that means "no photo".
 *
 * The fallback used to fire only when the URL was missing from the data. But
 * offline — or once the image cache has evicted a plant, and it holds 1,500 of
 * 4,736 — the URL is right there and the *fetch* is what fails. So the app
 * painted a dead box, and the detail photo, which carries real alt text, painted
 * a broken-image glyph with a plant name under it. Absence should look like
 * absence in both cases.
 */
export function Thumb({
  src,
  alt = "",
  fallbackClass,
}: {
  src: string | null;
  alt?: string;
  fallbackClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={fallbackClass} aria-hidden="true">
        ✿
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
