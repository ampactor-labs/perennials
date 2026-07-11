import { Link } from "react-router-dom";
import type { Plant } from "@/data/model";

function topTags(p: Plant): string[] {
  const tags: string[] = [];
  if (p.layer) tags.push(p.layer);
  if (p.lifeCycle) tags.push(p.lifeCycle);
  if (p.edible) tags.push("Edible");
  for (const f of p.functions.slice(0, 2)) tags.push(f);
  return tags.slice(0, 4);
}

export function PlantCard({ plant }: { plant: Plant }) {
  const warn = plant.warnings[0];
  return (
    <Link to={`/plant/${plant.slug}`} className="pcard">
      <div className="pcard-thumb">
        {plant.thumb ? (
          <img src={plant.thumb} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="pcard-noimg" aria-hidden="true">✿</span>
        )}
      </div>
      <div className="pcard-body">
        <div className="pcard-name">{plant.name}</div>
        <div className="pcard-sci binomial">{plant.scientificName}</div>
        <div className="pcard-tags">
          {topTags(plant).map((t) => (
            <span key={t} className="ptag">
              {t}
            </span>
          ))}
          {warn && <span className="ptag ptag--warn">{warn}</span>}
        </div>
      </div>
    </Link>
  );
}
