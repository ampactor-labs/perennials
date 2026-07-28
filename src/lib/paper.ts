// Paper tooth, one recipe for every sheet surface.
//
// The SVG sheets (the plan, the elevation, the exported page) draw it with
// feTurbulence — resolution-free, rasterized once. The model's ground is a
// canvas texture, so it takes the same tooth as seeded speckle instead;
// deterministic, so a repaint never shimmers. Either way it is a whisper:
// grain must never compete with a facet count or a 22px name, which is why
// the opacity lives here as one number both renderers share.
export const GRAIN = {
  frequency: 0.8,
  octaves: 2,
  /** Overlay opacity for the SVG turbulence rect. */
  opacity: 0.05,
} as const;

/** Deterministic speckle for a canvas sheet: the model's tooth. */
export function speckle(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
): void {
  // Park–Miller, seeded: the grain is part of the drawing, not a dice roll.
  let s = 48271;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  g.save();
  g.fillStyle = color;
  const n = Math.round((w * h) / 110);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.02 + rnd() * 0.04;
    g.fillRect(rnd() * w, rnd() * h, rnd() < 0.2 ? 2 : 1, 1);
  }
  g.restore();
}
