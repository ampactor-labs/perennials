import { DATA_BASE } from "@/data/store";

/**
 * Plant photos, at the size the box actually is.
 *
 * Every thumbnail used to be the full-resolution original — a 300px JPEG averaging
 * 58 KB — painted into a 56-pixel box. That is both the guide's largest ongoing
 * cellular cost and, on a retina phone, not even sharp: handing a browser one
 * image and asking it to guess is worse than handing it the pixels it wants.
 *
 * So the server resizes, and `srcset` lets the phone choose. A 3× screen asks for
 * 168 device pixels and gets the 192px file; a 1× laptop takes the 64px one. The
 * ladder stops at 300 because that is the resolution Permapeople actually holds —
 * there is no larger original to fetch, so anything above it would be an upscale
 * pretending to be a photo.
 */
const IMG_BASE = DATA_BASE.replace(/\/data$/, "");

const url = (id: number, w: number) => `${IMG_BASE}/img/${id}/${w}.webp`;

/** The candidates for a small square box: card, companion pill, omnibox row. */
export function thumbSrc(id: number) {
  return {
    src: url(id, 128),
    srcSet: [64, 128, 192].map((w) => `${url(id, w)} ${w}w`).join(", "),
  };
}

/** The detail-page photo. 300px is the whole source, so this is as good as it gets. */
export function photoSrc(id: number) {
  return { src: url(id, 300), srcSet: `${url(id, 192)} 192w, ${url(id, 300)} 300w` };
}

/** What the detail photo will actually occupy, so the browser can pick correctly. */
export const PHOTO_SIZES = "300px";
