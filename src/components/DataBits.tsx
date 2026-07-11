import type { LoadedPlant } from "@/data/types";
import { COLOR, WILDLIFE, type Color } from "@/data/vocab";

export function Swatch({ color, size }: { color: Color; size?: number }) {
  const hex = COLOR.meta[color].color;
  const s = size ?? 13;
  return (
    <span
      className="swatch"
      title={COLOR.meta[color].label}
      style={{ background: hex, width: s, height: s }}
    />
  );
}

export function BloomSwatches({ colors, size }: { colors: Color[]; size?: number }) {
  if (colors.length === 0) return <span className="tag">foliage / no bloom</span>;
  return (
    <span className="swatch-row" aria-label={`Bloom: ${colors.map((c) => COLOR.meta[c].label).join(", ")}`}>
      {colors.map((c) => (
        <Swatch key={c} color={c} size={size} />
      ))}
    </span>
  );
}

/** The functional roles a plant plays, as compact tags. */
export function FunctionTags({ plant }: { plant: LoadedPlant }) {
  const f = plant.functions;
  const tags: { key: string; label: string; color: string }[] = [];
  if (f.nitrogenFixer) tags.push({ key: "n", label: "N-fixer", color: "#8bbf6a" });
  if (f.accumulator) {
    const n = f.accumulator.minerals.length;
    tags.push({ key: "acc", label: `Accumulator · ${n}`, color: "#c8863c" });
  }
  if (f.groundcover) tags.push({ key: "gc", label: "Groundcover", color: "#5f9e6a" });
  if (f.nectary) tags.push({ key: "nec", label: "Insectary", color: "#f2c14e" });
  return (
    <>
      {tags.map((t) => (
        <span key={t.key} className="tag tag--fn">
          <span className="tag-dot" style={{ background: t.color }} />
          {t.label}
        </span>
      ))}
    </>
  );
}

export function WildlifeTags({ plant }: { plant: LoadedPlant }) {
  return (
    <>
      {plant.wildlife.map((w) => (
        <span key={w} className="tag">
          <span className="tag-dot" style={{ background: WILDLIFE.meta[w].color }} />
          {WILDLIFE.meta[w].label}
        </span>
      ))}
    </>
  );
}
