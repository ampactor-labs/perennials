import type { Plant } from "@/data/model";
import type { BloomSlot } from "./bloom";
import type { TokenView } from "@/components/YardCanvas";
import type { Fig } from "@/components/ElevationView";
import { archetypeOf, CROWN_RATIO, ELEV_H, figurePaths, GROUND_Y, tickStep, TOP_Y } from "./elevation";
import { blobToDataUrl, getPhoto } from "./photos";
import { SHEET_H, SHEET_W, pathD, type Yard } from "./yards";
import { shareFiles } from "./share";

/**
 * The sheet she hands a client.
 *
 * The export re-renders from scratch with the light-paper palette baked in as
 * literal hex (a specimen sheet, not a screenshot of dark mode) and a footer
 * that keeps the picture honest on its own: "Diagram, not to scale", the
 * coverage lines, and the source attribution (CC BY-SA is a licence term on a
 * shared file, not a nicety). No source photographs go in, so the canvas
 * never taints and the raster works with no signal; her own ground photo is a
 * local blob, taints nothing and needs no signal, so it rides in as a data
 * URL, washed the way the screen washes it.
 *
 * When any placed plant has a height, the elevation joins the sheet below the
 * plan: the same figures she saw, from the same geometry (lib/elevation.ts),
 * with the same stand line printed under them. A planting plan and what it
 * grows into are one handout. Alongside the PNG rides a plain-text plant
 * list, the format guaranteed to outlive the app.
 */

// tokens.css, light theme, as literals: the exported file has no stylesheet.
const C = {
  paper: "#e7e4d3",
  ink: "#23291f",
  inkSoft: "#4b5142",
  inkFaint: "#5c5e4c",
  line: "#cac6b0",
  green: "#33503a",
  sepia: "#6f5f45",
};

const BAND_GAP = 28;
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function tokenSvg(t: TokenView): string {
  const fill =
    t.state === "fill" && t.fill
      ? t.fill
      : t.state === "ink"
        ? C.inkFaint
        : t.state === "hatch"
          ? "url(#hatch)"
          : C.paper;
  const parts: string[] = [];
  if (t.ring) {
    parts.push(
      `<circle cx="${t.x}" cy="${t.y}" r="${t.ring}" fill="none" stroke="${C.sepia}" stroke-width="2" stroke-dasharray="7 6"/>`,
    );
  }
  if (t.show === "match") {
    parts.push(
      `<circle cx="${t.x}" cy="${t.y}" r="27" fill="none" stroke="${C.green}" stroke-width="3.5"/>`,
    );
  }
  if (t.witness) {
    parts.push(
      `<circle cx="${t.x}" cy="${t.y}" r="22" fill="none" stroke="${C.sepia}" stroke-width="2.5"/>`,
    );
  }
  parts.push(
    `<circle cx="${t.x}" cy="${t.y}" r="16" fill="${fill}" stroke="${C.inkSoft}" stroke-width="2"${t.gone ? ' stroke-dasharray="4 4"' : ""}${t.show === "other" ? ' opacity="0.35"' : ""}/>`,
  );
  parts.push(
    `<text x="${t.x}" y="${t.y + 40}" text-anchor="middle" font-family="${SANS}" font-size="22" fill="${C.inkSoft}"${t.show === "other" ? ' opacity="0.5"' : ""}>${esc(t.label)}</text>`,
  );
  return parts.join("");
}

/** The elevation band, and the line that keeps it honest. Empty when no
 *  placed plant has a height: a band of bare marks would say nothing the
 *  plan doesn't already say. */
function elevationBand(figs: Fig[], y0: number): { svg: string; standLine: string } | null {
  const measured = figs.filter((f) => f.height !== null);
  if (measured.length === 0) return null;
  const maxM = Math.max(...measured.map((f) => f.height!));
  const K = (GROUND_Y - TOP_Y) / maxM;
  const step = tickStep(maxM);
  const g0 = y0 + GROUND_Y;
  const parts: string[] = [];

  parts.push(
    `<rect x="1" y="${y0 + 1}" width="${SHEET_W - 2}" height="${ELEV_H - 2}" fill="none" stroke="${C.line}" stroke-width="2"/>`,
    `<rect x="2" y="${g0}" width="${SHEET_W - 4}" height="${ELEV_H - GROUND_Y - 2}" fill="${C.sepia}" opacity="0.08"/>`,
  );
  for (let i = 1; i * step <= maxM + 1e-9; i++) {
    const ty = g0 - i * step * K;
    parts.push(
      `<line x1="14" x2="30" y1="${ty}" y2="${ty}" stroke="${C.line}" stroke-width="1.5"/>`,
      `<text x="36" y="${ty + 7}" font-family="${SANS}" font-size="19" fill="${C.inkFaint}">${Math.round(i * step * 100) / 100} m</text>`,
    );
  }
  parts.push(
    `<line x1="1" x2="${SHEET_W - 1}" y1="${g0}" y2="${g0}" stroke="${C.inkSoft}" stroke-width="2"/>`,
  );

  for (const f of [...figs].sort((a, b) => a.depth - b.depth)) {
    if (f.height !== null) {
      const kind = archetypeOf(f.layer);
      const h = f.height * K;
      const w = Math.max(18, (f.width ?? f.height * CROWN_RATIO[kind]) * K);
      const fig = figurePaths(kind, f.x, g0, h, w);
      const fill =
        f.state === "fill" && f.fill
          ? f.fill
          : f.state === "ink"
            ? C.inkFaint
            : f.state === "hatch"
              ? "url(#hatch)"
              : C.paper;
      const stroke = f.hers ? C.sepia : C.inkSoft;
      parts.push(`<g${f.show === "other" ? ' opacity="0.35"' : ""}>`);
      if (fig.trunk) {
        parts.push(
          `<line x1="${fig.trunk[0][0]}" y1="${fig.trunk[0][1]}" x2="${fig.trunk[1][0]}" y2="${fig.trunk[1][1]}" stroke="${stroke}" stroke-width="4"/>`,
        );
      }
      parts.push(
        `<path d="${fig.body}" fill="${fill}" stroke="${stroke}" stroke-width="2"${kind === "vine" ? ' stroke-dasharray="6 5"' : ""}/>`,
      );
      if (fig.taproot) {
        parts.push(
          `<line x1="${fig.taproot[0][0]}" y1="${fig.taproot[0][1]}" x2="${fig.taproot[1][0]}" y2="${fig.taproot[1][1]}" stroke="${C.sepia}" stroke-width="2.5" stroke-dasharray="4 4"/>`,
        );
      }
      parts.push(`</g>`);
    }
    // The same mark it is on the plan, standing on the line; the spacing ring
    // stays with the plan, where its units mean something.
    parts.push(tokenSvg({ ...f, y: g0, ring: undefined }));
  }

  const withH = measured.length;
  const yours = figs.filter((f) => f.hers).length;
  const rest = figs.length - withH;
  const standLine = `${withH} of ${figs.length} stand at a known height${yours ? `, ${yours} by your hand` : ""}${rest > 0 ? "; the rest hold the line unmeasured" : ""}. Shapes follow the layer, not the plant.`;
  return { svg: parts.join(""), standLine };
}

function sheetSvg(
  yard: Yard,
  tokens: TokenView[],
  figs: Fig[],
  slot: BloomSlot | null,
  bloomLine: string | null,
  ground: string | null,
): { svg: string; height: number } {
  const strokes = yard.strokes
    .map((s) =>
      s.k === "label"
        ? `<text x="${s.at[0]}" y="${s.at[1]}" font-family="${SERIF}" font-style="italic" font-size="26" fill="${C.sepia}">${esc(s.text)}</text>`
        : `<path d="${pathD(s.pts, s.k === "area")}" fill="${s.k === "area" ? C.sepia + "22" : "none"}" stroke="${C.sepia}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");

  const rose = `<g transform="translate(${SHEET_W - 80} 90) rotate(${yard.north})">
    <circle r="48" fill="${C.paper}" stroke="${C.line}" stroke-width="2"/>
    <path d="M0 38 L0 -26" stroke="${C.inkSoft}" stroke-width="2.5"/>
    <path d="M0 -40 L-7 -24 L7 -24 Z" fill="${C.inkSoft}"/>
    <text y="-6" text-anchor="middle" font-family="${SANS}" font-size="20" fill="${C.inkSoft}">N</text>
  </g>`;

  const band = elevationBand(figs, SHEET_H + BAND_GAP);
  const base = SHEET_H + (band ? BAND_GAP + ELEV_H : 0);

  const date = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const title = `${yard.name} · ${date} · Diagram, not to scale${slot ? ` · ${slot}` : ""}`;
  const rows = [bloomLine, band?.standLine ?? null].filter((s): s is string => !!s);
  const attrY = base + 104 + 38 * rows.length;
  const height = attrY + 40;
  const foot = [
    `<line x1="40" x2="${SHEET_W - 40}" y1="${base + 26}" y2="${base + 26}" stroke="${C.line}" stroke-width="2"/>`,
    `<text x="40" y="${base + 66}" font-family="${SERIF}" font-size="28" fill="${C.ink}">${esc(title)}</text>`,
    ...rows.map(
      (r, i) =>
        `<text x="40" y="${base + 104 + 38 * i}" font-family="${SANS}" font-size="22" fill="${C.inkSoft}">${esc(r)}</text>`,
    ),
    `<text x="40" y="${attrY}" font-family="${SANS}" font-size="20" fill="${C.inkFaint}">Data: Permapeople (CC BY-SA 4.0) · GloBI (CC BY 4.0) · USDA PLANTS (public domain)</text>`,
  ].join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${SHEET_W} ${height}" width="${SHEET_W}" height="${height}">
    <defs>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="${C.paper}"/>
        <line x1="0" y1="0" x2="0" y2="7" stroke="${C.inkFaint}" stroke-width="1.6"/>
      </pattern>
      <filter id="wash"><feColorMatrix type="saturate" values="0.2"/></filter>
    </defs>
    <rect width="${SHEET_W}" height="${height}" fill="${C.paper}"/>
    ${ground ? `<image href="${ground}" xlink:href="${ground}" x="0" y="0" width="${SHEET_W}" height="${SHEET_H}" preserveAspectRatio="xMidYMid meet" opacity="0.5" filter="url(#wash)"/>` : ""}
    <rect x="1" y="1" width="${SHEET_W - 2}" height="${SHEET_H - 2}" fill="none" stroke="${C.line}" stroke-width="2"/>
    ${strokes}
    ${tokens.map(tokenSvg).join("")}
    ${rose}
    ${band?.svg ?? ""}
    ${foot}
  </svg>`;
  return { svg, height };
}

function plantListText(yard: Yard, placedPlants: Plant[]): string {
  const byId = new Map(placedPlants.map((p) => [p.id, p]));
  const lines: string[] = [
    `${yard.name} · ${new Date().toLocaleDateString()}`,
    "Diagram, not to scale.",
    "",
    `PLANTS (${yard.plants.length})`,
  ];
  for (const pl of yard.plants) {
    const p = byId.get(pl.id);
    if (!p) {
      lines.push(`${pl.name}  (no longer in this copy of the guide)`);
      continue;
    }
    lines.push(`${p.name} — ${p.scientificName}`);
    lines.push(
      `  Bloom: ${p.bloomColor ?? "not in our sources"}${p.bloomPeriod ? `, ${p.bloomPeriod}` : ""}`,
    );
    lines.push(`  Visitors: ${p.attracts?.length ? p.attracts.join(", ") : "not in our sources"}`);
    if (p.functions.length) lines.push(`  Functions: ${p.functions.join(", ")}`);
    if (p.cautions) lines.push(`  Caution: ${p.cautions} (Permapeople's wording)`);
  }
  lines.push(
    "",
    "Data: Permapeople (CC BY-SA 4.0) · GloBI (CC BY 4.0) · USDA PLANTS (public domain)",
  );
  return lines.join("\n") + "\n";
}

export async function exportYard(
  yard: Yard,
  tokens: TokenView[],
  extra: {
    slot: BloomSlot | null;
    bloomLine: string | null;
    placedPlants: Plant[];
    figs: Fig[];
  },
): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `yard-${yard.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sketch"}-${stamp}`;
  const txt = new File([plantListText(yard, extra.placedPlants)], `${base}.txt`, {
    type: "text/plain",
  });

  // The ground fetch fails on its own: an unreadable photo costs the sheet its
  // backdrop, never the sheet.
  let ground: string | null = null;
  if (yard.underlay) {
    try {
      const blob = await getPhoto(yard.underlay);
      if (blob) ground = await blobToDataUrl(blob);
    } catch {
      ground = null;
    }
  }

  try {
    const { svg, height } = sheetSvg(yard, tokens, extra.figs, extra.slot, extra.bloomLine, ground);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = SHEET_W * 2;
    canvas.height = height * 2;
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const png = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("raster failed"))), "image/png"),
    );
    await shareFiles([new File([png], `${base}.png`, { type: "image/png" }), txt]);
  } catch {
    // A raster can fail in odd browsers; the plant list must still get out.
    await shareFiles([txt]);
  }
}
