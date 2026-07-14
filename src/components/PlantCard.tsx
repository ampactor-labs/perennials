import { memo } from "react";
import { Link } from "react-router-dom";
import type { Plant } from "@/data/model";
import { Thumb } from "./Thumb";

type Tag = { text: string; fn?: boolean };

// tokens.css: "saturated color only ever encodes plant data (bloom swatches,
// function tags)". `.ptag--fn` was written for exactly this and then only ever
// used on the detail page, so on the grid she scans at arm's length "Nitrogen
// fixer" — the reason you plant the thing — looked identical to "Perennial".
function topTags(p: Plant): Tag[] {
  const tags: Tag[] = [];
  if (p.layer) tags.push({ text: p.layer });
  if (p.lifeCycle) tags.push({ text: p.lifeCycle });
  if (p.edible) tags.push({ text: "Edible" });
  for (const f of p.functions.slice(0, 2)) tags.push({ text: f, fn: true });
  return tags.slice(0, 4);
}

const HARM = /toxic|poison/i;
// "Might be mistaken for poisonous plants" is about identification, not toxicity.
const LOOKALIKE = /mistaken|confused with/i;
// Longer than this and it won't fit a nowrap chip; one caution runs to 773 characters.
const CHIP_MAX = 22;

/**
 * What the caution chip says. `warnings` is a coarse filter vocabulary — model.ts
 * says plainly never to show it to a human — and printing warnings[0] let the label
 * that happened to sort first speak for the plant. Chokecherry said "Weed potential"
 * and never mentioned the poisonous seeds; asparagus said "Toxic" beside "Edible"
 * when the source only ever called the fruits toxic.
 *
 * So: use the source's own words, and lead with the clause that can hurt her. Fall
 * back to the coarse label only when the verbatim clause is too long to fit, where
 * it is a true summary even if it isn't a specific one.
 */
function cautionText(p: Plant): string | null {
  const clauses = (p.cautions ?? "")
    .split(/[,;.]/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (clauses.length === 0) return p.warnings[0] ?? null;

  const harm = clauses.find((c) => HARM.test(c) && !LOOKALIKE.test(c));
  const lead = harm ?? clauses[0];
  if (lead.length > CHIP_MAX) return p.warnings[0] ?? null;

  const text = lead[0].toUpperCase() + lead.slice(1);
  const rest = clauses.length - 1;
  return rest > 0 ? `${text} +${rest}` : text;
}

export const PlantCard = memo(function PlantCard({ plant }: { plant: Plant }) {
  const warn = cautionText(plant);
  return (
    <Link to={`/plant/${plant.slug}`} className="pcard">
      <div className="pcard-thumb">
        <Thumb id={plant.id} has={!!plant.thumb} sizes="56px" fallbackClass="pcard-noimg" />
      </div>
      <div className="pcard-body">
        <div className="pcard-name">{plant.name}</div>
        <div className="pcard-sci binomial">{plant.scientificName}</div>
        <div className="pcard-tags">
          {topTags(plant).map((t) => (
            <span key={t.text} className={t.fn ? "ptag ptag--fn" : "ptag"}>
              {t.text}
            </span>
          ))}
          {warn && <span className="ptag ptag--warn">{warn}</span>}
        </div>
      </div>
    </Link>
  );
});
