import { memo } from "react";
import { Link } from "react-router-dom";
import type { Plant } from "@/data/model";
import type { Hers } from "@/lib/mine";
import { Thumb } from "./Thumb";

type Tag = { text: string; fn?: boolean; hers?: boolean };

// tokens.css: "saturated color only ever encodes plant data (bloom swatches,
// function tags)". `.ptag--fn` was written for exactly this and then only ever
// used on the detail page, so on the grid she scans at arm's length "Nitrogen
// fixer" (the reason you plant the thing) looked identical to "Perennial".
//
// Her values ride in the same rows in her sepia, where the source is silent
// on the field: the fourth source visible in the grid, never dressed as the
// others'. The card stays a memo, so hers arrives as a prop from the grids
// that already hold the index rather than a context read per card.
function topTags(p: Plant, hers?: Hers): Tag[] {
  const tags: Tag[] = [];
  if (p.layer) tags.push({ text: p.layer });
  else if (hers?.facets.layer?.[0]) tags.push({ text: hers.facets.layer[0], hers: true });
  if (p.lifeCycle) tags.push({ text: p.lifeCycle });
  else if (hers?.facets.lifeCycle?.[0]) tags.push({ text: hers.facets.lifeCycle[0], hers: true });
  if (p.edible) tags.push({ text: "Edible" });
  for (const f of p.functions.slice(0, 2)) tags.push({ text: f, fn: true });
  if (p.functions.length === 0)
    for (const f of hers?.facets.functions?.slice(0, 2) ?? []) tags.push({ text: f, hers: true });
  return tags.slice(0, 4);
}

const HARM = /toxic|poison/i;
// "Might be mistaken for poisonous plants" is about identification, not toxicity.
const LOOKALIKE = /mistaken|confused with/i;
// Longer than this and it won't fit a nowrap chip; one caution runs to 773 characters.
const CHIP_MAX = 22;

/**
 * What the caution chip says. `warnings` is a coarse filter vocabulary that
 * model.ts says plainly never to show a human, and printing warnings[0] let the label
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

export const PlantCard = memo(function PlantCard({
  plant,
  hers,
}: {
  plant: Plant;
  /** Her side of this plant, when the grid holds the index. */
  hers?: Hers;
}) {
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
          {topTags(plant, hers).map((t) => (
            <span
              key={t.text}
              className={t.hers ? "ptag ptag--mine" : t.fn ? "ptag ptag--fn" : "ptag"}
            >
              {t.text}
            </span>
          ))}
          {warn && <span className="ptag ptag--warn">{warn}</span>}
        </div>
      </div>
    </Link>
  );
});
