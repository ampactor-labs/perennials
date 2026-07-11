import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { getPlant } from "@/data";
import type { LoadedPlant } from "@/data/types";
import {
  EASE,
  EDIBLE_PART,
  GROWTH_RATE,
  HABIT,
  LAYER,
  LIFE_CYCLE,
  MINERAL,
  MOISTURE,
  SEASON,
  SITE_CONDITION,
  SUN,
  WATER,
} from "@/data/vocab";
import { LayerSpine } from "@/components/LayerSpine";
import { BloomSwatches, FunctionTags, WildlifeTags } from "@/components/DataBits";
import { IconAlert, IconChevronLeft, IconInfo } from "@/components/icons";

function ft(r: { min: number; max: number }) {
  return r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="spec-row">
      <span className="spec-label">{label}</span>
      <span className="spec-val">{children}</span>
    </div>
  );
}

function Functions({ plant }: { plant: LoadedPlant }) {
  const acc = plant.functions.accumulator;
  const hasAny =
    plant.functions.nitrogenFixer ||
    acc ||
    plant.functions.groundcover ||
    plant.functions.nectary;
  if (!hasAny) return null;
  return (
    <section className="panel">
      <div className="panel-title">Functions — the work it does</div>
      <div className="chip-row" style={{ marginBottom: acc ? "var(--sp-4)" : 0 }}>
        <FunctionTags plant={plant} />
      </div>
      {acc && (
        <>
          <div className="spec-label" style={{ marginBottom: "var(--sp-2)" }}>
            Concentrates{" "}
            {acc.rating && (
              <span className="rating" title={`Confidence ${acc.rating}/3`}>
                {"★".repeat(acc.rating)}
                {"☆".repeat(3 - acc.rating)}
              </span>
            )}
          </div>
          <div className="mineral-grid">
            {acc.minerals.map((m) => (
              <div className="mineral" key={m}>
                <span className="sym">{m}</span>
                <span className="name">{MINERAL.meta[m].label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function FoodMedicine({ plant }: { plant: LoadedPlant }) {
  if (plant.edibleParts.length === 0 && !plant.medicinal) return null;
  return (
    <section className="panel span-2">
      <div className="panel-title">Food &amp; medicine</div>
      {plant.superfood && (
        <div className="tag tag--fn" style={{ marginBottom: "var(--sp-3)" }}>
          Superfood
        </div>
      )}
      {plant.edibleParts.length > 0 && (
        <div style={{ marginBottom: plant.medicinal ? "var(--sp-4)" : 0 }}>
          <div className="spec-label" style={{ marginBottom: "var(--sp-2)" }}>
            Edible parts
          </div>
          <div className="chip-row">
            {plant.edibleParts.map((e) => (
              <span key={e} className="tag">
                {EDIBLE_PART.meta[e].label}
              </span>
            ))}
          </div>
        </div>
      )}
      {plant.medicinal && (
        <div>
          <div className="spec-label" style={{ marginBottom: "var(--sp-2)" }}>
            Medicinal
          </div>
          <ul className="med-list">
            {plant.medicinal.uses.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
          {plant.medicinal.note && (
            <div className="callout callout--warn" style={{ marginTop: "var(--sp-3)" }}>
              <IconAlert />
              <span>{plant.medicinal.note}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function PlantPage() {
  const { id } = useParams();
  const plant = id ? getPlant(id) : undefined;

  if (!plant) {
    return (
      <div className="page wrap">
        <div className="empty">
          <h3>Not in the guide</h3>
          <p>That plant isn't in the seed set yet.</p>
          <Link className="btn btn--ghost" to="/" style={{ marginTop: "var(--sp-3)" }}>
            Back to the guide
          </Link>
        </div>
      </div>
    );
  }

  const seasons = plant.bloomSeason.map((s) => SEASON.meta[s].label).join(" → ");

  return (
    <div className="page wrap detail">
      <div className="detail-top">
        <Link to="/" className="back-link">
          <IconChevronLeft width={18} height={18} />
          The guide
        </Link>
      </div>

      <header className="detail-head">
        <div>
          <h1 className="detail-title">{plant.commonName}</h1>
          <div className="detail-binomial binomial">{plant.scientificName}</div>
          {plant.family && <div className="detail-family eyebrow">{plant.family}</div>}
          {plant.otherNames && plant.otherNames.length > 0 && (
            <div className="detail-othernames">also: {plant.otherNames.join(", ")}</div>
          )}
        </div>
        <div className="detail-swatches">
          <BloomSwatches colors={plant.bloomColors} size={18} />
        </div>
      </header>

      <p className="detail-summary">{plant.summary}</p>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-title">At a glance</div>
          <Row label="Life cycle">{LIFE_CYCLE.meta[plant.lifeCycle].label}</Row>
          <Row label="Layer / habit">
            {LAYER.meta[plant.layer].label} · {HABIT.meta[plant.habit].label}
          </Row>
          <Row label="Mature size">
            <span className="mono">
              {ft(plant.height)} × {ft(plant.spread)} ft
            </span>{" "}
            <span className="spec-label">(h × w)</span>
          </Row>
          <Row label="Hardiness">
            <span className="mono">
              zones {plant.hardiness.min}–{plant.hardiness.max}
            </span>
          </Row>
          <Row label="Sun">{plant.sun.map((s) => SUN.meta[s].label).join(", ")}</Row>
          <Row label="Soil moisture">
            {plant.moisture.map((m) => MOISTURE.meta[m].label).join(", ")}
          </Row>
          <Row label="Water need">{WATER.meta[plant.water].label}</Row>
          <Row label="Bloom">
            {plant.bloomColors.length ? (
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <BloomSwatches colors={plant.bloomColors} />
                {seasons && <span className="spec-label">{seasons}</span>}
              </span>
            ) : (
              "grown for foliage"
            )}
          </Row>
          <Row label="Growth rate">{GROWTH_RATE.meta[plant.growthRate].label}</Row>
          <Row label="Ease">{EASE.meta[plant.ease].label}</Row>
          <Row label="Self-seeds">{plant.selfSeeds ? "yes" : "no"}</Row>
          {plant.nativeRange && <Row label="Native range">{plant.nativeRange}</Row>}
        </section>

        <section className="panel">
          <div className="panel-title">Where it sits</div>
          <div className="layer-figure">
            <LayerSpine layer={plant.layer} size="lg" />
            <div className="caption">
              <b>{LAYER.meta[plant.layer].label}</b>
              {LAYER.meta[plant.layer].hint}
              <p style={{ marginTop: "var(--sp-2)" }}>
                Its stratum in the forest-garden layer cake — what it stacks above and below.
              </p>
            </div>
          </div>
        </section>

        <Functions plant={plant} />

        {plant.wildlife.length > 0 && (
          <section className="panel">
            <div className="panel-title">Wildlife it supports</div>
            <div className="chip-row">
              <WildlifeTags plant={plant} />
            </div>
          </section>
        )}

        <FoodMedicine plant={plant} />

        {plant.indicatorOf && plant.indicatorOf.length > 0 && (
          <section className="panel span-2">
            <div className="panel-title">Reads the land</div>
            <p className="spec-label" style={{ marginBottom: "var(--sp-3)" }}>
              Where it turns up growing wild, the soil is often telling you:
            </p>
            <div className="chip-row">
              {plant.indicatorOf.map((c) => (
                <span key={c} className="tag">
                  {SITE_CONDITION.meta[c].label}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {plant.notes && (
        <div className="callout" style={{ marginTop: "var(--sp-5)" }}>
          <IconInfo />
          <span>{plant.notes}</span>
        </div>
      )}

      <div className="provenance">
        <div style={{ marginBottom: "var(--sp-2)" }}>
          {plant.sources.map((s) => (
            <span key={s} className="src">
              {s}
            </span>
          ))}
        </div>
        {plant.unknown && plant.unknown.length > 0 && (
          <div className="unknown-note">
            Not yet recorded: {plant.unknown.join(", ")}. Left blank rather than guessed.
          </div>
        )}
      </div>
    </div>
  );
}
