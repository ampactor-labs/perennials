import type { TokenView } from "./YardCanvas";
import {
  archetypeOf,
  CROWN_RATIO,
  ELEV_H,
  ELEV_W,
  figurePaths,
  GROUND_Y,
  tickStep,
} from "@/lib/elevation";
import { earthPathD, sectionOf } from "@/lib/ground";
import { growthBand } from "@/lib/growth";
import type { GroundMark } from "@/lib/yards";

/**
 * The elevation: the same placed plants, standing — a section through the
 * one yard, not a second drawing of it. Read-only on purpose; the sheet is
 * where her hand works, this is where the record performs. A tap selects,
 * nothing else, so there is no gesture arbitration to get wrong.
 *
 * Every mark keeps the sheet's vocabulary exactly: state fill, witness ring,
 * show ring, dashed when gone, name below. What elevation adds is the one
 * thing the sheet cannot say, and only for plants whose height is known: a
 * layer-shaped figure at that height, in her ink when the measurement is hers.
 *
 * When she has shaped the ground (lib/ground.ts), the earth stops being a
 * band and becomes the land's own skyline; every figure stands at its
 * footing, so a tree in a dip starts low and a bed on a bank starts high.
 * The horizon line stays put as the zero the rule measures from.
 */

export type Fig = TokenView & {
  /** Sheet y, for painter's order: low on the sheet is near the viewer. */
  depth: number;
  layer: string | null;
  /** Metres, or null: not in our data, and the plant stays a mark on the line. */
  height: number | null;
  /** The height is her measurement, so the figure wears her ink. */
  hers: boolean;
  width: number | null;
  /** The record's pace word (or hers), for the years axis; null bands nothing. */
  growth: string | null;
  /** The ground under the plant, metres from the level she calls zero: her
   *  shaped land read at this spot, 0 on a sheet she never shaped. The page
   *  computes it once (lib/ground.ts) so every projection stands the plant
   *  on the same footing. */
  footing: number;
  /** Her photo of this plant, by key, for the model to stand up. */
  photo?: string;
};

/** Height standing at year N: the band's middle when a pace is recorded,
 *  mature when none is (the coverage line owns that gap), mature when the
 *  years axis is off. */
export function grownM(f: Fig, years: number | null): number {
  if (f.height === null || years === null) return f.height ?? 0;
  const band = growthBand(f.growth, years);
  return band ? f.height * ((band.lo + band.hi) / 2) : f.height;
}

const TOKEN_R = 16;

function Silhouette({
  f,
  gy,
  scale,
  years,
}: {
  f: Fig;
  /** Where this figure's ground stands, view units: the datum line bent by
   *  its footing. */
  gy: number;
  scale: number;
  years: number | null;
}) {
  if (f.height === null || scale <= 0) return null;
  const kind = archetypeOf(f.layer);
  const nowM = grownM(f, years);
  const h = Math.max(2, nowM * scale);
  const w = Math.max(18, (f.width ?? f.height * CROWN_RATIO[kind]) * scale * (f.height > 0 ? nowM / f.height : 1));
  const fig = figurePaths(kind, f.x, gy, h, w);
  // The years axis draws today solid and mature as a ghost behind it, so the
  // gap between them is the drawing, not a caption.
  const matureW = Math.max(18, (f.width ?? f.height * CROWN_RATIO[kind]) * scale);
  const ghost =
    years !== null && nowM < f.height - 0.01
      ? figurePaths(kind, f.x, gy, f.height * scale, matureW)
      : null;
  const fill =
    f.state === "fill"
      ? f.fill
      : f.state === "ink"
        ? "var(--ink-faint)"
        : f.state === "hatch"
          ? "url(#elev-hatch)"
          : "var(--paper)";
  const cls = `yard-fig${f.hers ? " yard-fig--hers" : ""}${kind === "vine" ? " yard-fig--vine" : ""}`;
  return (
    <g className={cls}>
      {ghost && <path d={ghost.body} className="yard-fig-ghost" />}
      {fig.trunk && (
        <line
          x1={fig.trunk[0][0]}
          y1={fig.trunk[0][1]}
          x2={fig.trunk[1][0]}
          y2={fig.trunk[1][1]}
          className="yard-fig-trunk"
        />
      )}
      <path d={fig.body} fill={fill} />
      {fig.taproot && (
        <line
          x1={fig.taproot[0][0]}
          y1={fig.taproot[0][1]}
          x2={fig.taproot[1][0]}
          y2={fig.taproot[1][1]}
          className="yard-taproot"
        />
      )}
    </g>
  );
}

export function ElevationView({
  figs,
  ground,
  sel,
  years,
  onSelect,
}: {
  figs: Fig[];
  /** The heights she set; empty is the flat band the view always drew. */
  ground: GroundMark[];
  sel: string | null;
  /** Years since planting, or null for the mature view. The rule's scale
   *  stays pinned to mature heights so the axis never rescales mid-scrub. */
  years: number | null;
  onSelect: (uid: string | null) => void;
}) {
  const measured = figs.filter((f) => f.height !== null);
  const { scale, top, bottom, skyline } = sectionOf(
    ground,
    measured.map((f) => f.footing + f.height!),
  );
  const step = scale > 0 ? tickStep(Math.max(top, -bottom)) : 0;
  const ticks =
    step > 0
      ? [
          ...Array.from({ length: Math.floor(top / step + 1e-9) }, (_, i) => (i + 1) * step),
          ...Array.from({ length: Math.floor(-bottom / step + 1e-9) }, (_, i) => -(i + 1) * step),
        ]
      : [];
  // Far first: low on the sheet reads as near, so it paints last and in front.
  const ordered = [...figs].sort((a, b) => a.depth - b.depth);

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * ELEV_W;
    let best: Fig | null = null;
    let bestD = 42;
    for (const f of figs) {
      const d = Math.abs(x - f.x);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    onSelect(best ? best.uid : null);
  };

  return (
    <svg
      className="yard-canvas yard-elev"
      viewBox={`0 0 ${ELEV_W} ${ELEV_H}`}
      onPointerDown={pick}
      role="img"
      aria-label="Elevation of the placed plants"
    >
      <defs>
        <pattern
          id="elev-hatch"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="7" fill="var(--paper)" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ink-faint)" strokeWidth="1.6" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={ELEV_W} height={ELEV_H} className="yard-paper" />
      {/* the spine glyph's below-ground wash — the flat band she never shaped,
          or the skyline of the land she did */}
      {skyline ? (
        <path d={earthPathD(skyline, scale, GROUND_Y, ELEV_H)} className="yard-earth" />
      ) : (
        <rect x="0" y={GROUND_Y} width={ELEV_W} height={ELEV_H - GROUND_Y} className="yard-earth" />
      )}

      {ticks.map((m) => (
        <g key={m} className="yard-elev-tick">
          <line x1={14} x2={30} y1={GROUND_Y - m * scale} y2={GROUND_Y - m * scale} />
          <text x={36} y={GROUND_Y - m * scale + 7}>
            {Math.round(m * 100) / 100} m
          </text>
        </g>
      ))}

      {/* With a shaped ground this is the datum, not the surface: the zero
          the rule and her heights measure from, dashed so it reads as a rule
          line wherever the land leaves it. */}
      <line
        x1="0"
        x2={ELEV_W}
        y1={GROUND_Y}
        y2={GROUND_Y}
        className={skyline ? "yard-horizon yard-horizon--datum" : "yard-horizon"}
      />

      {ordered.map((f) => {
        const gy = GROUND_Y - f.footing * scale;
        const fill =
          f.state === "fill"
            ? f.fill
            : f.state === "ink"
              ? "var(--ink-faint)"
              : f.state === "hatch"
                ? "url(#elev-hatch)"
                : "var(--paper)";
        return (
          <g key={f.uid} className={f.show === "other" ? "yard-token yard-token--dim" : "yard-token"}>
            <Silhouette f={f} gy={gy} scale={scale} years={years} />
            {f.show === "match" && (
              <circle cx={f.x} cy={gy} r={TOKEN_R + 11} className="yard-show" />
            )}
            {f.witness && (
              <circle cx={f.x} cy={gy} r={TOKEN_R + 6} className="yard-witness" />
            )}
            {sel === f.uid && (
              <circle cx={f.x} cy={gy} r={TOKEN_R + 17} className="yard-sel" />
            )}
            <circle
              cx={f.x}
              cy={gy}
              r={TOKEN_R}
              fill={fill}
              className={f.gone ? "yard-mark yard-mark--gone" : "yard-mark"}
            />
            <text x={f.x} y={gy + TOKEN_R + 24} className="yard-name">
              {f.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
