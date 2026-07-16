import { DATA_BASE } from "@/data/store";

/**
 * Plant photos, at the size the box actually is.
 *
 * Every thumbnail used to be the full-resolution original (a 300px JPEG averaging
 * 58 KB) painted into a 56-pixel box. That is both the guide's largest ongoing
 * cellular cost and, on a retina phone, not even sharp: handing a browser one
 * image and asking it to guess is worse than handing it the pixels it wants.
 *
 * So the server resizes, and `srcset` lets the phone choose. A 3× screen asks for
 * 168 device pixels and gets the 192px file; a 1× laptop takes the 64px one. The
 * ladder stops at 300 because that is the resolution Permapeople actually holds;
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

/**
 * The plant-page photo.
 *
 * The ladder reaches 800 because that is where the source reaches. Permapeople
 * serves two images per plant and the pipeline was only reading the 300px one, so
 * the photo was being stretched across the screen from a third of the pixels it
 * needed; that, and not the compression, was the softness. On her phone the
 * figure is ~328 CSS px wide, which at a 3x device ratio wants ~984 real pixels;
 * 800 gets most of the way there, where 300 never could.
 */
export function photoSrc(id: number) {
  return {
    src: url(id, 600),
    srcSet: [300, 400, 600, 800].map((w) => `${url(id, w)} ${w}w`).join(", "),
  };
}

/** The figure fills the content column, capped where the source runs out. */
export const PHOTO_SIZES = "(min-width: 40rem) 480px, 100vw";
