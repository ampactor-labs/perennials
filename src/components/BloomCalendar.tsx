import { Fragment } from "react";
import { Link } from "react-router-dom";
import type { Plant } from "@/data/model";
import {
  BLOOM_HEX,
  BLOOM_SEASONS,
  BLOOM_SLOTS,
  SLOT_TICK,
  bloomPeriodLabel,
  bloomSlots,
  type BloomSlot,
} from "@/lib/bloom";
import { phenologyLine } from "@/lib/phenology";
import { seenSlots, useSeen } from "@/lib/seen";

type Row = {
  plant: Plant;
  period: string;
  /** the printed record: USDA's period, spread over its slots */
  slots: readonly BloomSlot[];
  /** her record: days she tapped "Mark blooming today", coarsened onto the axis */
  hand: readonly BloomSlot[];
};

/** The first slot either record covers; the grid sorts by it. */
const firstSlot = (r: Row) =>
  BLOOM_SLOTS.findIndex((s) => r.slots.includes(s) || r.hand.includes(s));

/** "late winter, fall": her words, not an array printed at her. */
function joinLower(slots: readonly BloomSlot[]): string {
  const w = slots.map((s) => s.toLowerCase());
  if (w.length === 1) return w[0];
  if (w.length === 2) return `${w[0]} and ${w[1]}`;
  return `${w.slice(0, -1).join(", ")}, and ${w[w.length - 1]}`;
}

/**
 * Bloom succession over the plants she has kept.
 *
 * The question this answers is the forest-garden one: is something in flower
 * across the whole season, or does the yard go quiet in August? It only ever
 * runs over her kept list; across all 8,800 plants the axis would be almost
 * entirely holes, because USDA records a bloom period for about one in eight.
 *
 * The honesty rule bites hardest here. A plant with no record at all is NOT a
 * row of empty cells; that reads as "never flowers", which is a claim nobody
 * made. It is named below the grid instead, and an empty slot is only ever
 * "nothing in our data", never "nothing blooms".
 *
 * Two records draw here and never mix. The bar is the printed one, USDA's
 * continent-average period. The sepia dot above it is hers: her hand above
 * the printed record. It earns a plant its row even when the printed
 * period is blank, which on her kept list is most of them.
 */
export function BloomCalendar({ plants }: { plants: Plant[] }) {
  const { seen } = useSeen();
  if (plants.length === 0) return null;

  const handSlots = (id: number) => seenSlots(seen, id);

  const rows: Row[] = plants
    .map((plant) => ({
      plant,
      period: plant.bloomPeriod ?? "",
      slots: bloomSlots(plant.bloomPeriod),
      hand: handSlots(plant.id),
    }))
    .filter((r) => r.slots.length > 0 || r.hand.length > 0)
    .sort((a, b) => firstSlot(a) - firstSlot(b) || a.plant.name.localeCompare(b.plant.name));

  const unrecorded = plants.filter(
    (p) => bloomSlots(p.bloomPeriod).length === 0 && handSlots(p.id).length === 0,
  );
  const counts = BLOOM_SLOTS.map(
    (slot) => rows.filter((r) => r.slots.includes(slot) || r.hand.includes(slot)).length,
  );
  const gaps = BLOOM_SLOTS.filter((_, i) => counts[i] === 0);
  const printed = rows.filter((r) => r.slots.length > 0).length;
  const marked = rows.filter((r) => r.hand.length > 0).length;

  return (
    <section className="panel bcal">
      <div className="panel-title">Bloom succession</div>

      {rows.length > 0 && (
        <>
          <div className="bcal-grid">
            <div className="bcal-corner" />
            {BLOOM_SEASONS.map((s) => (
              <div key={s.name} className="bcal-season" style={{ gridColumn: `span ${s.span}` }}>
                {s.name}
              </div>
            ))}

            <div className="bcal-corner bcal-tickrow" />
            {BLOOM_SLOTS.map((slot) => (
              <div key={slot} className="bcal-tick bcal-tickrow">
                {SLOT_TICK[slot]}
              </div>
            ))}

            <div className="bcal-head bcal-head--sum">In bloom</div>
            {BLOOM_SLOTS.map((slot, i) => (
              <div
                key={slot}
                className={counts[i] ? "bcal-sum" : "bcal-sum bcal-sum--gap"}
                title={counts[i] ? `${counts[i]} in bloom in ${slot.toLowerCase()}` : `Nothing recorded in bloom in ${slot.toLowerCase()}`}
              >
                {counts[i] || "–"}
              </div>
            ))}

            {rows.map(({ plant, period, slots, hand }) => {
              // Her marks landing outside the printed band is worth a word,
              // not a redesign: the row's word-line says the divergence
              // instead, and since the sentence names both records, nothing
              // the line used to say is lost.
              const outran = phenologyLine(hand, period);
              return (
                <Fragment key={plant.slug}>
                  <div className="bcal-head">
                    <Link to={`/plant/${plant.slug}`} className="bcal-name">
                      {plant.name}
                    </Link>
                    {/* The datum in words, per record, since the cells themselves
                        are decoration and this is what a screen reader gets. */}
                    <span className={outran ? "bcal-period bcal-period--mine" : "bcal-period"}>
                      {outran ?? (
                        <>
                          {period ? bloomPeriodLabel(period) : "Seen by you"}
                          {period && hand.length > 0 && " · seen by you"}
                        </>
                      )}
                    </span>
                  </div>
                  {BLOOM_SLOTS.map((slot) => (
                    <div key={slot} className="bcal-cell" aria-hidden="true">
                      {hand.includes(slot) && <span className="bcal-dot" />}
                      {slots.includes(slot) && (
                        <span
                          className="bcal-bar"
                          style={{
                            // No recorded colour means no colour. Picking one would
                            // be a claim; the bar still says "in bloom".
                            background: plant.bloomColor ? BLOOM_HEX[plant.bloomColor] : undefined,
                          }}
                        />
                      )}
                    </div>
                  ))}
                </Fragment>
              );
            })}
          </div>

          {marked > 0 && (
            <p className="bcal-legend">
              <span className="bcal-dot" aria-hidden="true" /> seen by you ·{" "}
              <span className="bcal-bar" aria-hidden="true" /> the printed record
            </p>
          )}

          <p className="bcal-verdict">
            {gaps.length === 0
              ? "Something you've kept is recorded in bloom in every part of the year."
              : `Nothing you've kept is recorded in bloom in ${joinLower(gaps)}.`}
          </p>
        </>
      )}

      {/* Coverage, always: a partial facet has to say how partial. */}
      <p className="bcal-coverage">
        {printed === 0
          ? `No bloom period is recorded for any of the ${plants.length === 1 ? "plant" : `${plants.length} plants`} you've kept.`
          : `${printed} of ${plants.length} kept ${plants.length === 1 ? "plant has" : "plants have"} a bloom period recorded.`}{" "}
        {marked > 0 &&
          `You've marked ${marked} ${marked === 1 ? "plant" : "plants"} in bloom yourself. `}
        Bloom comes from USDA PLANTS, which covers North-American species, so a blank is a
        gap in our data rather than a plant that doesn't flower.
      </p>

      {unrecorded.length > 0 && (
        <div className="bcal-unrecorded">
          {unrecorded.map((p) => (
            <Link key={p.slug} to={`/plant/${p.slug}`} className="ptag">
              {p.name}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
