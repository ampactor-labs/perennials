import { Link } from "react-router-dom";
import type { Plant } from "@/data/model";
import { useDataState } from "@/data/store";
import { useKept } from "@/lib/kept";
import { useSeen } from "@/lib/seen";
import { inBloomNow, todaySlot } from "@/lib/today";
import { useYards } from "@/lib/yards";

/**
 * The garden as it stands when she opens the guide: today's season, who is
 * recorded in bloom among her plants (kept and placed, one list), her yards
 * a tap away. A strip, not a dashboard — three lines when she has a garden,
 * nothing at all when she doesn't, so a first visit is unchanged.
 *
 * The honesty rule word here is "recorded": the band answers for USDA, her
 * marks answer for her (in her sepia), and a plant with neither is a gap in
 * our data, never a quiet garden.
 */
export function Today() {
  const state = useDataState();
  const { kept } = useKept();
  const { yards } = useYards();
  const { seen } = useSeen();
  if (state.status !== "ready") return null;
  const { byId } = state.data;

  // Her plants: kept and placed, one set. A plant kept and also placed in
  // two yards is one plant.
  const ids = new Set<number>(kept.map((k) => k.id));
  for (const y of yards) for (const pl of y.plants) ids.add(pl.id);
  const plants = [...ids].map((id) => byId.get(id)).filter((p): p is Plant => !!p);

  if (plants.length === 0 && yards.length === 0) return null;

  const slot = todaySlot();
  const { recorded, byHer } = inBloomNow(plants, seen, slot);
  const inBloom = recorded.length + byHer.length;
  const named = [...recorded, ...byHer.map((p) => ({ p, hers: true }))].slice(0, 6);

  return (
    <section className="today" aria-label="The garden today">
      <span className="today-season">{slot}.</span>{" "}
      {plants.length > 0 && (
        <span className="today-line">
          {inBloom === 0
            ? `Nothing among your ${plants.length} ${plants.length === 1 ? "plant" : "plants"} is recorded in bloom now — a blank is a gap in our data, not a quiet garden.`
            : `${inBloom} of your ${plants.length} ${plants.length === 1 ? "plant is" : "plants are"} recorded in bloom now${byHer.length > 0 ? `, ${byHer.length} by your own marks` : ""}.`}
        </span>
      )}
      {inBloom > 0 && (
        <span className="today-names">
          {named.map((x) => {
            const p = "hers" in x ? x.p : x;
            const hers = "hers" in x;
            return (
              <Link key={p.slug} to={`/plant/${p.slug}`} className={hers ? "ptag ptag--mine" : "ptag"}>
                {p.name}
              </Link>
            );
          })}
          {inBloom > named.length && (
            <span className="today-more">and {inBloom - named.length} more</span>
          )}
        </span>
      )}
      {yards.length > 0 && (
        <span className="today-yards">
          {yards.map((y) => (
            <Link key={y.id} to={`/yard/${y.id}`} className="spot">
              ⌂ {y.name}
            </Link>
          ))}
        </span>
      )}
    </section>
  );
}
