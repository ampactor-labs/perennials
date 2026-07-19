import type { TokenView } from "./YardCanvas";
import {
  archetypeOf,
  CROWN_RATIO,
  ELEV_H,
  ELEV_W,
  figurePaths,
  GROUND_Y,
  tickStep,
  TOP_Y,
} from "@/lib/elevation";

/**
 * The elevation: the same placed plants, standing. Read-only on purpose; the
 * sheet is where her hand works, this is where the record performs. A tap
 * selects, nothing else, so there is no gesture arbitration to get wrong.
 *
 * Every mark keeps the sheet's vocabulary exactly: state fill, witness ring,
 * show ring, dashed when gone, name below. What elevation adds is the one
 * thing the sheet cannot say, and only for plants whose height is known: a
 * layer-shaped figure at that height, in her ink when the measurement is hers.
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
};

const TOKEN_R = 16;

function Silhouette({ f, scale }: { f: Fig; scale: number }) {
  if (f.height === null || scale <= 0) return null;
  const kind = archetypeOf(f.layer);
  const h = f.height * scale;
  const w = Math.max(18, (f.width ?? f.height * CROWN_RATIO[kind]) * scale);
  const fig = figurePaths(kind, f.x, GROUND_Y, h, w);
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
  sel,
  onSelect,
}: {
  figs: Fig[];
  sel: string | null;
  onSelect: (uid: string | null) => void;
}) {
  const measured = figs.filter((f) => f.height !== null);
  const maxM = measured.length ? Math.max(...measured.map((f) => f.height!)) : 0;
  const scale = maxM > 0 ? (GROUND_Y - TOP_Y) / maxM : 0;
  const step = maxM > 0 ? tickStep(maxM) : 0;
  const ticks =
    step > 0
      ? Array.from({ length: Math.floor(maxM / step + 1e-9) }, (_, i) => (i + 1) * step)
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
      {/* the spine glyph's below-ground wash, at sheet size */}
      <rect x="0" y={GROUND_Y} width={ELEV_W} height={ELEV_H - GROUND_Y} className="yard-earth" />

      {ticks.map((m) => (
        <g key={m} className="yard-elev-tick">
          <line x1={14} x2={30} y1={GROUND_Y - m * scale} y2={GROUND_Y - m * scale} />
          <text x={36} y={GROUND_Y - m * scale + 7}>
            {Math.round(m * 100) / 100} m
          </text>
        </g>
      ))}

      <line x1="0" x2={ELEV_W} y1={GROUND_Y} y2={GROUND_Y} className="yard-horizon" />

      {ordered.map((f) => {
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
            <Silhouette f={f} scale={scale} />
            {f.show === "match" && (
              <circle cx={f.x} cy={GROUND_Y} r={TOKEN_R + 11} className="yard-show" />
            )}
            {f.witness && (
              <circle cx={f.x} cy={GROUND_Y} r={TOKEN_R + 6} className="yard-witness" />
            )}
            {sel === f.uid && (
              <circle cx={f.x} cy={GROUND_Y} r={TOKEN_R + 17} className="yard-sel" />
            )}
            <circle
              cx={f.x}
              cy={GROUND_Y}
              r={TOKEN_R}
              fill={fill}
              className={f.gone ? "yard-mark yard-mark--gone" : "yard-mark"}
            />
            <text x={f.x} y={GROUND_Y + TOKEN_R + 24} className="yard-name">
              {f.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
