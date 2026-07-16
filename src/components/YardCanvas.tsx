import { useRef, useState } from "react";
import { SHEET_H, SHEET_W, commitStroke, pathD, type Pt, type Yard } from "@/lib/yards";

/**
 * The sheet. A fixed 1000×1414 viewBox with no pan and no zoom — the whole
 * yard is one screen, so screen-to-sheet is one rectangle division and there
 * is no gesture arbitration to get wrong. One finger acts; a second finger is
 * ignored. Everything transient (a stroke mid-draw, a token mid-drag) lives
 * here in component state; nothing commits until the finger lifts.
 */

/** How one placed plant should draw. The page computes this; the canvas only obeys. */
export type TokenView = {
  uid: string;
  x: number;
  y: number;
  /** Short name printed beside the mark — legible in sun, and the only thing
   *  that isn't decoration. */
  label: string;
  /** fill: recorded bloom colour. ink: in bloom, colour unrecorded — still
   *  "in bloom", claiming no colour. hollow: recorded and quiet. hatch: no
   *  record at all — unknown must never look dormant. */
  state: "fill" | "ink" | "hollow" | "hatch";
  fill?: string;
  /** She saw it bloom (in this slot, or ever in Year view). Sepia — her hand. */
  witness: boolean;
  /** Her spacing estimate, sheet units. */
  ring?: number;
  /** The Show control: match rings green, other dims, unrecorded stays plain. */
  show: "match" | "other" | "unrecorded" | null;
  /** Dropped from the dataset on a refresh; drawn from its snapshot name. */
  gone: boolean;
};

export type Mode = "move" | "draw" | "area" | "label" | "place";

const ROSE = { x: SHEET_W - 80, y: 90, r: 48 };
const TOKEN_R = 16;

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// The ref carries the latest value itself: React batches the setLive that
// paints the transient, so a pointerup must never read its result back out of
// state — it could lag the finger by one sample.
type Gesture =
  | { t: "draw"; pts: Pt[] }
  | { t: "drag"; uid: string; start: [number, number]; moved: boolean; at?: Pt }
  | { t: "north"; deg?: number }
  | { t: "ring"; uid: string; r?: number };

export function YardCanvas({
  yard,
  tokens,
  mode,
  sel,
  armed,
  onPlace,
  onLabelAt,
  onStroke,
  onSelect,
  onMove,
  onNorth,
  onRing,
}: {
  yard: Yard;
  tokens: TokenView[];
  mode: Mode;
  sel: string | null;
  /** Whether Place mode has a plant loaded — an unarmed tap should do nothing. */
  armed: boolean;
  onPlace: (p: Pt) => void;
  onLabelAt: (p: Pt) => void;
  onStroke: (k: "line" | "area", pts: Pt[]) => void;
  onSelect: (uid: string | null) => void;
  onMove: (uid: string, p: Pt) => void;
  onNorth: (deg: number) => void;
  onRing: (uid: string, r: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [live, setLive] = useState<{
    stroke?: Pt[];
    drag?: { uid: string; at: Pt };
    north?: number;
    ring?: { uid: string; r: number };
  }>({});

  const toPt = (e: React.PointerEvent): Pt => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * SHEET_W,
      ((e.clientY - rect.top) / rect.height) * SHEET_H,
    ];
  };

  const tokenAt = (p: Pt): TokenView | null => {
    let best: TokenView | null = null;
    let bestD = 42;
    for (const t of tokens) {
      const d = dist(p, [t.x, t.y]);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  };

  const down = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    const p = toPt(e);

    if (mode === "draw" || mode === "area") {
      gesture.current = { t: "draw", pts: [p] };
      setLive({ stroke: [p] });
      return;
    }
    if (mode === "label") {
      onLabelAt([Math.round(p[0]), Math.round(p[1])]);
      return;
    }
    if (mode === "place") {
      if (armed) onPlace([Math.round(p[0]), Math.round(p[1])]);
      return;
    }

    // move mode: her spacing ring first (it is the thinnest target), then the
    // compass, then the nearest token, then empty paper clears the selection.
    const selected = sel ? tokens.find((t) => t.uid === sel) : null;
    if (selected?.ring && Math.abs(dist(p, [selected.x, selected.y]) - selected.ring) < 26) {
      gesture.current = { t: "ring", uid: selected.uid };
      return;
    }
    if (dist(p, [ROSE.x, ROSE.y]) < ROSE.r + 8) {
      gesture.current = { t: "north" };
      return;
    }
    const hit = tokenAt(p);
    if (hit) {
      gesture.current = { t: "drag", uid: hit.uid, start: [e.clientX, e.clientY], moved: false };
      return;
    }
    onSelect(null);
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || !e.isPrimary) return;
    const p = toPt(e);

    if (g.t === "draw") {
      const last = g.pts[g.pts.length - 1];
      // Decimate at the source: a point every 4 sheet-units bounds the buffer
      // no matter how long the thumb wanders.
      if (dist(p, last) >= 4 && g.pts.length < 2000) {
        g.pts.push(p);
        setLive({ stroke: [...g.pts] });
      }
      return;
    }
    if (g.t === "drag") {
      if (!g.moved && Math.hypot(e.clientX - g.start[0], e.clientY - g.start[1]) > 8) {
        g.moved = true;
      }
      if (g.moved) {
        g.at = p;
        setLive({ drag: { uid: g.uid, at: p } });
      }
      return;
    }
    if (g.t === "north") {
      const deg = (Math.atan2(p[0] - ROSE.x, -(p[1] - ROSE.y)) * 180) / Math.PI;
      g.deg = Math.round(deg / 15) * 15;
      setLive({ north: g.deg });
      return;
    }
    if (g.t === "ring") {
      const t = tokens.find((x) => x.uid === g.uid);
      if (t) {
        g.r = Math.round(Math.max(24, Math.min(400, dist(p, [t.x, t.y]))));
        setLive({ ring: { uid: g.uid, r: g.r } });
      }
    }
  };

  const up = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;

    if (g.t === "draw") {
      setLive({});
      const pts = commitStroke(g.pts);
      // A dot is a mis-tap, not a bed: require a stroke a pen would keep.
      if (pts.length >= 2 && dist(pts[0], pts[pts.length - 1]) + pts.length > 14) {
        onStroke(mode === "area" ? "area" : "line", pts);
      }
      return;
    }
    if (g.t === "drag") {
      setLive({});
      if (g.moved && g.at) {
        onMove(g.uid, [
          Math.round(Math.max(0, Math.min(SHEET_W, g.at[0]))),
          Math.round(Math.max(0, Math.min(SHEET_H, g.at[1]))),
        ]);
      } else {
        onSelect(g.uid);
      }
      return;
    }
    if (g.t === "north") {
      setLive({});
      if (g.deg !== undefined) onNorth(((g.deg % 360) + 360) % 360);
      return;
    }
    if (g.t === "ring") {
      setLive({});
      if (g.r) onRing(g.uid, g.r);
    }
    void e;
  };

  const north = live.north ?? yard.north;

  return (
    <svg
      ref={svgRef}
      className={`yard-canvas yard-canvas--${mode}`}
      viewBox={`0 0 ${SHEET_W} ${SHEET_H}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="img"
      aria-label={`Sketch of ${yard.name}`}
    >
      <defs>
        {/* Unknown wears hatching, the calendar's own texture for a gap in the
            record — never the hollow that means "recorded and quiet". */}
        <pattern
          id="yard-hatch"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="7" fill="var(--paper)" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ink-faint)" strokeWidth="1.6" />
        </pattern>
      </defs>

      <rect x="0" y="0" width={SHEET_W} height={SHEET_H} className="yard-paper" />

      {/* her hand: beds, lines, labels — all sepia */}
      {yard.strokes.map((s) =>
        s.k === "label" ? (
          <text key={s.id} x={s.at[0]} y={s.at[1]} className="yard-label">
            {s.text}
          </text>
        ) : (
          <path
            key={s.id}
            d={pathD(s.pts, s.k === "area")}
            className={s.k === "area" ? "yard-area" : "yard-line"}
          />
        ),
      )}
      {live.stroke && (
        <path
          d={pathD(live.stroke, mode === "area")}
          className={mode === "area" ? "yard-area" : "yard-line"}
        />
      )}

      {/* the placed plants */}
      {tokens.map((t) => {
        const at: Pt = live.drag?.uid === t.uid ? live.drag.at : [t.x, t.y];
        const ring = live.ring?.uid === t.uid ? live.ring.r : t.ring;
        const fill =
          t.state === "fill"
            ? t.fill
            : t.state === "ink"
              ? "var(--ink-faint)"
              : t.state === "hatch"
                ? "url(#yard-hatch)"
                : "var(--paper)";
        return (
          <g key={t.uid} className={t.show === "other" ? "yard-token yard-token--dim" : "yard-token"}>
            {ring && (
              <circle cx={at[0]} cy={at[1]} r={ring} className="yard-ring" />
            )}
            {t.show === "match" && (
              <circle cx={at[0]} cy={at[1]} r={TOKEN_R + 11} className="yard-show" />
            )}
            {t.witness && (
              <circle cx={at[0]} cy={at[1]} r={TOKEN_R + 6} className="yard-witness" />
            )}
            {sel === t.uid && (
              <circle cx={at[0]} cy={at[1]} r={TOKEN_R + 17} className="yard-sel" />
            )}
            <circle
              cx={at[0]}
              cy={at[1]}
              r={TOKEN_R}
              fill={fill}
              className={t.gone ? "yard-mark yard-mark--gone" : "yard-mark"}
            />
            <text x={at[0]} y={at[1] + TOKEN_R + 24} className="yard-name">
              {t.label}
            </text>
          </g>
        );
      })}

      {/* the compass — hers, an annotation, so the drawing never rotates */}
      <g
        className="yard-rose"
        transform={`translate(${ROSE.x} ${ROSE.y}) rotate(${north})`}
      >
        <circle r={ROSE.r} className="yard-rose-face" />
        <path d={`M0 ${ROSE.r - 10} L0 ${-ROSE.r + 22}`} className="yard-rose-needle" />
        <path
          d={`M0 ${-ROSE.r + 8} L-7 ${-ROSE.r + 24} L7 ${-ROSE.r + 24} Z`}
          className="yard-rose-tip"
        />
        <text y={-ROSE.r + 42} className="yard-rose-n">
          N
        </text>
      </g>
    </svg>
  );
}
