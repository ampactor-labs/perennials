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

type Row = { plant: Plant; period: string; slots: readonly BloomSlot[] };

/** "late winter, fall" — her words, not an array printed at her. */
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
 * runs over her kept list — across all 8,800 plants the axis would be almost
 * entirely holes, because USDA records a bloom period for about one in eight.
 *
 * The honesty rule bites hardest here. A plant with no recorded period is NOT a
 * row of empty cells — that reads as "never flowers", which is a claim the data
 * never made. It is named below the grid instead, and an empty slot is only ever
 * "nothing recorded", never "nothing blooms".
 */
export function BloomCalendar({ plants }: { plants: Plant[] }) {
  if (plants.length === 0) return null;

  const rows: Row[] = plants
    .map((plant) => ({
      plant,
      period: plant.bloomPeriod ?? "",
      slots: bloomSlots(plant.bloomPeriod),
    }))
    .filter((r): r is Row => r.slots.length > 0)
    .sort(
      (a, b) =>
        BLOOM_SLOTS.indexOf(a.slots[0]) - BLOOM_SLOTS.indexOf(b.slots[0]) ||
        a.plant.name.localeCompare(b.plant.name),
    );

  const unrecorded = plants.filter((p) => bloomSlots(p.bloomPeriod).length === 0);
  const counts = BLOOM_SLOTS.map((slot) => rows.filter((r) => r.slots.includes(slot)).length);
  const gaps = BLOOM_SLOTS.filter((_, i) => counts[i] === 0);

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

            {rows.map(({ plant, period, slots }) => (
              <Fragment key={plant.slug}>
                <div className="bcal-head">
                  <Link to={`/plant/${plant.slug}`} className="bcal-name">
                    {plant.name}
                  </Link>
                  {/* The word the source actually recorded. The bars show the
                      shape; this is the datum, and it is what a screen reader
                      gets, since the cells themselves are decoration. */}
                  <span className="bcal-period">{bloomPeriodLabel(period)}</span>
                </div>
                {BLOOM_SLOTS.map((slot) => (
                  <div key={slot} className="bcal-cell" aria-hidden="true">
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
            ))}
          </div>

          <p className="bcal-verdict">
            {gaps.length === 0
              ? "Something you've kept is recorded in bloom in every part of the year."
              : `Nothing you've kept is recorded in bloom in ${joinLower(gaps)}.`}
          </p>
        </>
      )}

      {/* Coverage, always — a partial facet has to say how partial. */}
      <p className="bcal-coverage">
        {rows.length === 0
          ? `No bloom period is recorded for any of the ${plants.length === 1 ? "plant" : `${plants.length} plants`} you've kept.`
          : `${rows.length} of ${plants.length} kept ${plants.length === 1 ? "plant has" : "plants have"} a bloom period recorded.`}{" "}
        Bloom comes from USDA PLANTS, which covers North-American species, so a blank is a
        gap in the record rather than a plant that doesn't flower.
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
