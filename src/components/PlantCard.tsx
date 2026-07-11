import { Link } from "react-router-dom";
import type { LoadedPlant } from "@/data/types";
import { SUN } from "@/data/vocab";
import { LayerSpine } from "./LayerSpine";
import { BloomSwatches, FunctionTags } from "./DataBits";

function ft(r: { min: number; max: number }) {
  return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}

export function PlantCard({ plant, index = 0 }: { plant: LoadedPlant; index?: number }) {
  const sun = plant.sun.map((s) => SUN.meta[s].label).join(" · ");
  return (
    <Link
      to={`/plant/${plant.id}`}
      className="specimen"
      style={{ animationDelay: `${Math.min(index, 12) * 22}ms` }}
    >
      <div className="specimen-spine">
        <LayerSpine layer={plant.layer} />
      </div>
      <div className="specimen-body">
        <div className="specimen-name">{plant.commonName}</div>
        <div className="specimen-binomial binomial">{plant.scientificName}</div>
        <p className="specimen-summary">{plant.summary}</p>
        <div className="specimen-tags">
          <BloomSwatches colors={plant.bloomColors} />
          <FunctionTags plant={plant} />
        </div>
        <div className="specimen-meta">
          <span>
            <b>{ft(plant.height)}</b> ft tall
          </span>
          <span>
            zones <b>{plant.hardiness.min}–{plant.hardiness.max}</b>
          </span>
          <span>{sun}</span>
        </div>
      </div>
    </Link>
  );
}
