import type { Plant } from "@/data/model";
import type { BloomSlot } from "./bloom";
import type { TokenView } from "@/components/YardCanvas";
import { SHEET_H, SHEET_W, pathD, type Yard } from "./yards";
import { shareFiles } from "./share";

/**
 * The sheet she hands a client.
 *
 * The export re-renders the sketch from scratch with the light-paper palette
 * baked in as literal hex (a specimen sheet, not a screenshot of dark mode)
 * and a footer that keeps the picture honest on its own: "Diagram, not to
 * scale", the coverage line, and the source attribution (CC BY-SA is a licence
 * term on a shared file, not a nicety). No photographs go in, so the canvas
 * never taints and the raster works with no signal. Alongside the PNG rides a
 * plain-text plant list, the format guaranteed to outlive the app.
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

const FOOT = 170;
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

function sheetSvg(
  yard: Yard,
  tokens: TokenView[],
  slot: BloomSlot | null,
  bloomLine: string | null,
): string {
  const H = SHEET_H + FOOT;
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

  const date = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const title = `${yard.name} · ${date} · Diagram, not to scale${slot ? ` · ${slot}` : ""}`;
  const foot = `
    <line x1="40" x2="${SHEET_W - 40}" y1="${SHEET_H + 26}" y2="${SHEET_H + 26}" stroke="${C.line}" stroke-width="2"/>
    <text x="40" y="${SHEET_H + 66}" font-family="${SERIF}" font-size="28" fill="${C.ink}">${esc(title)}</text>
    ${bloomLine ? `<text x="40" y="${SHEET_H + 104}" font-family="${SANS}" font-size="22" fill="${C.inkSoft}">${esc(bloomLine)}</text>` : ""}
    <text x="40" y="${SHEET_H + 140}" font-family="${SANS}" font-size="20" fill="${C.inkFaint}">Data: Permapeople (CC BY-SA 4.0) · GloBI (CC BY 4.0) · USDA PLANTS (public domain)</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_W} ${H}" width="${SHEET_W}" height="${H}">
    <defs>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="${C.paper}"/>
        <line x1="0" y1="0" x2="0" y2="7" stroke="${C.inkFaint}" stroke-width="1.6"/>
      </pattern>
    </defs>
    <rect width="${SHEET_W}" height="${H}" fill="${C.paper}"/>
    <rect x="1" y="1" width="${SHEET_W - 2}" height="${SHEET_H - 2}" fill="none" stroke="${C.line}" stroke-width="2"/>
    ${strokes}
    ${tokens.map(tokenSvg).join("")}
    ${rose}
    ${foot}
  </svg>`;
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
  extra: { slot: BloomSlot | null; bloomLine: string | null; placedPlants: Plant[] },
): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `yard-${yard.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sketch"}-${stamp}`;
  const txt = new File([plantListText(yard, extra.placedPlants)], `${base}.txt`, {
    type: "text/plain",
  });

  try {
    const svg = sheetSvg(yard, tokens, extra.slot, extra.bloomLine);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = SHEET_W * 2;
    canvas.height = (SHEET_H + FOOT) * 2;
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
