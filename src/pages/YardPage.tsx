import { lazy, Suspense, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Plant } from "@/data/model";
import { useDataState } from "@/data/store";
import { BLOOM_HEX, bloomPeriodLabel, bloomSlots, type BloomSlot } from "@/lib/bloom";
import { useKept } from "@/lib/kept";
import { mineFor, useMine } from "@/lib/mine";
import { deletePhoto, putPhoto, useMinePhoto } from "@/lib/photos";
import { ACCESS } from "@/lib/query";
import { seenSlots, useSeen } from "@/lib/seen";
import {
  MAX_LABEL,
  MAX_PLANTS,
  MAX_STROKES,
  type Pt,
  type Yard,
  useYards,
} from "@/lib/yards";
import { exportYard } from "@/lib/yardExport";
import { standing } from "@/lib/elevation";
import { AddMine } from "@/components/AddMine";
import { ElevationView, type Fig } from "@/components/ElevationView";
import { YardCanvas, type Mode, type TokenView } from "@/components/YardCanvas";
import { YearScrubber } from "@/components/YearScrubber";
import { Thumb } from "@/components/Thumb";
import { IconChevronLeft, IconX } from "@/components/icons";

const uid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// three.js rides in this chunk and this chunk only; the guide's first paint
// pays nothing for the third dimension.
const YardModel = lazy(() =>
  import("@/components/YardModel").then((m) => ({ default: m.YardModel })),
);

const short = (n: string) => (n.length > 16 ? n.slice(0, 15) + "…" : n);

/**
 * The yard sketch: her hand on a fixed sheet, the record performing on top.
 *
 * The page owns the state machine; the canvas only draws and reports gestures.
 * Every committed gesture writes the whole yard back to the store (undo is a
 * stack of whole values), and a refused write (quota, private mode) is said
 * out loud, because a silently lost client plan is the one failure this lane
 * cannot afford.
 */
export function YardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const state = useDataState();
  const { yards, put, remove } = useYards();
  const { kept } = useKept();
  const { seen } = useSeen();
  const { mine } = useMine();

  const [mode, setMode] = useState<Mode>("move");
  const [view, setView] = useState<"sheet" | "elevation" | "model">("sheet");
  const [armedId, setArmedId] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [slot, setSlot] = useState<BloomSlot | null>(null);
  const [show, setShow] = useState<string>("");
  const [pendingLabel, setPendingLabel] = useState<Pt | null>(null);
  const [labelText, setLabelText] = useState("");
  const [saved, setSaved] = useState(true);
  const [findText, setFindText] = useState("");
  const [past, setPast] = useState<Yard[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [laying, setLaying] = useState(false);
  const pickGround = useRef<HTMLInputElement>(null);

  const yard = yards.find((y) => y.id === id);
  const underlayUrl = useMinePhoto(yard?.underlay);

  // ACCESS values come back bare, one-valued or absent; the yard wants lists.
  const asList = (v: readonly string[] | string | null): readonly string[] =>
    v === null ? [] : typeof v === "string" ? [v] : v;
  if (state.status !== "ready" || !yard) {
    return (
      <div className="page wrap">
        <div className="empty">
          <h3>{state.status !== "ready" ? "Loading…" : "No such yard"}</h3>
          <Link className="btn btn--ghost" to="/yards" style={{ marginTop: "var(--sp-3)" }}>
            Back to Yards
          </Link>
        </div>
      </div>
    );
  }
  // herIndex is the same lookup ACCESS reads everywhere else in the guide.
  // The yard used to read p.functions, p.attracts, p.layer and p.bloomColor
  // raw, which made it the one room in the house where her answers went
  // silent: a bloom colour she recorded filtered the browse grid and never
  // painted her own sheet. Every read below goes through ACCESS now.
  const { byId, mine: herIndex } = state.data;

  const commit = (next: Yard) => {
    setPast((p) => [...p.slice(-49), yard]);
    setSaved(put(next));
  };
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    // Undo un-draws her ink; it never swaps the paper. The ground rides
    // outside the snapshots, so undoing past a photo change cannot resurrect
    // a key whose blob is already deleted, or detach one she just laid.
    setSaved(put({ ...prev, underlay: yard.underlay }));
    setSel(null);
  };

  /* ---- how each placed plant draws ----------------------------------- */

  const showKind = show ? show.slice(0, show.indexOf(":")) : null;
  const showValue = show ? show.slice(show.indexOf(":") + 1) : null;

  const tokens: TokenView[] = yard.plants.map((pl) => {
    const p = byId.get(pl.id);
    const her = herIndex.get(pl.id);
    const slots = p ? bloomSlots(p.bloomPeriod) : [];
    // The first colour with a swatch paints the mark. Hers arrives through
    // ACCESS in the catalogue's spelling, so her "purple" finds its hex; a
    // colour of her own coinage ("cream") is true and unpaintable, and the
    // mark stays with the states that claim nothing they can't show.
    const colours = p ? asList(ACCESS.bloomColor(p, her)) : [];
    const hex = colours.map((c) => BLOOM_HEX[c]).find((c): c is string => !!c);

    let tokenState: TokenView["state"];
    if (slot === null) {
      tokenState = hex ? "fill" : "hollow";
    } else if (slots.includes(slot)) {
      tokenState = hex ? "fill" : "ink";
    } else if (p?.bloomPeriod) {
      tokenState = "hollow";
    } else {
      tokenState = "hatch";
    }

    const mine = seenSlots(seen, pl.id);
    const witness = slot === null ? mine.length > 0 : mine.includes(slot);

    let showState: TokenView["show"] = null;
    if (p && showKind && showValue) {
      const have = asList(ACCESS[showKind](p, her));
      showState = have.length === 0 ? "unrecorded" : have.includes(showValue) ? "match" : "other";
    }

    return {
      uid: pl.uid,
      x: pl.x,
      y: pl.y,
      label: short(p?.name ?? pl.name),
      state: tokenState,
      fill: hex,
      witness,
      ring: pl.r,
      show: showState,
      gone: !p,
    };
  });

  /* ---- the same plants, standing: what elevation draws ----------------- */

  // Height and width resolve by the lane rule in metres: the record's value
  // is never overwritten, hers counts exactly where the record is silent, and
  // a plant with neither stays a mark on the line rather than growing a shape.
  const figs: Fig[] = yard.plants.map((pl, i) => {
    const p = byId.get(pl.id);
    const h = standing(p?.height ?? null, mineFor(mine, pl.id, "height")?.text);
    const w = standing(p?.width ?? null, mineFor(mine, pl.id, "width")?.text);
    return {
      ...tokens[i],
      depth: pl.y,
      // Through ACCESS, so a layer she filled shapes the figure where the
      // record is silent; the record's own layer always speaks first.
      layer: p ? (asList(ACCESS.layer(p, herIndex.get(pl.id)))[0] ?? null) : null,
      height: h?.m ?? null,
      hers: h?.hers ?? false,
      width: w?.m ?? null,
    };
  });

  /* ---- coverage, printed because a partial facet must ----------------- */

  const placed = yard.plants.length;
  const withPeriod = yard.plants.filter((pl) => bloomSlots(byId.get(pl.id)?.bloomPeriod).length > 0).length;
  const bloomLine =
    placed === 0
      ? null
      : slot === null
        ? `${withPeriod} of ${placed} placed ${placed === 1 ? "plant has" : "plants have"} a bloom period recorded.`
        : (() => {
            const lit = tokens.filter((t) => t.state === "fill" || t.state === "ink").length;
            const quiet = tokens.filter((t) => t.state === "hollow").length;
            const unknown = tokens.filter((t) => t.state === "hatch").length;
            return `In ${slot.toLowerCase()}: ${lit} recorded in bloom · ${quiet} recorded quiet · ${unknown} not in our data.`;
          })();

  const showLine = (() => {
    if (!show || placed === 0) return null;
    const m = tokens.filter((t) => t.show === "match").length;
    const u = tokens.filter((t) => t.show === "unrecorded").length;
    return `${m} of ${placed} recorded as ${showValue}${u > 0 ? `; ${u} not in our data` : ""}.`;
  })();

  // An empty yard has no side to see; the toggle only appears with a plant on
  // the sheet, and losing the last plant lands her back on the paper.
  const projection = placed > 0 ? view : "sheet";

  const elevLine = (() => {
    if (projection === "sheet") return null;
    const where = projection === "elevation" ? "the line" : "the ground";
    const withH = figs.filter((f) => f.height !== null).length;
    const yours = figs.filter((f) => f.hers).length;
    if (withH === 0)
      return `No height in our sources for any of these; each stands unmeasured on ${where}. Tap a mark to add yours.`;
    // "The rest" only when there is one: a full count claiming a remainder is
    // the small cousin of the absence-dressed-as-fact bug.
    const rest = placed - withH;
    return `${withH} of ${placed} stand at a known height${yours ? `, ${yours} by your hand` : ""}${rest > 0 ? `; the rest hold ${where} unmeasured` : ""}. Shapes follow the layer, not the plant.`;
  })();

  /* ---- the client questions this yard can be asked -------------------- */

  const placedPlants = yard.plants
    .map((pl) => byId.get(pl.id))
    .filter((p): p is Plant => !!p);
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  const askFunctions = uniq(placedPlants.flatMap((p) => [...asList(ACCESS.functions(p, herIndex.get(p.id)))]));
  const askVisitors = uniq(placedPlants.flatMap((p) => [...asList(ACCESS.attracts(p, herIndex.get(p.id)))]));
  const askLayers = uniq(placedPlants.flatMap((p) => [...asList(ACCESS.layer(p, herIndex.get(p.id)))]));

  /* ---- gesture commits ------------------------------------------------ */

  const say = (m: string) => {
    setNote(m);
    window.setTimeout(() => setNote(null), 4000);
  };

  /* ---- the ground under the ink --------------------------------------- */

  // Not a commit(): the photo is the sheet's ground, not a stroke, so it skips
  // the undo stack, and undo() carries the live ground forward. That is what
  // makes the eager blob delete safe: no snapshot can bring a dropped key back.
  const setUnderlay = (key: string | undefined) => {
    const old = yard.underlay;
    setSaved(put({ ...yard, underlay: key }));
    if (old && old !== key) void deletePhoto(old);
  };

  const layGround = async (file: File | undefined) => {
    if (!file) return;
    setLaying(true);
    try {
      setUnderlay(await putPhoto(file));
    } catch {
      say("That image couldn't be read.");
    } finally {
      setLaying(false);
    }
  };

  const onPlace = (p: Pt) => {
    if (armedId === null) return;
    if (yard.plants.length >= MAX_PLANTS) return say(`This sheet holds ${MAX_PLANTS} plants. Start a second yard.`);
    const plant = byId.get(armedId);
    if (!plant) return;
    commit({
      ...yard,
      plants: [...yard.plants, { uid: uid(), id: plant.id, name: plant.name, x: p[0], y: p[1] }],
    });
  };

  const onStroke = (k: "line" | "area", pts: Pt[]) => {
    if (yard.strokes.length >= MAX_STROKES) return say(`This sheet holds ${MAX_STROKES} strokes. Start a second yard.`);
    commit({ ...yard, strokes: [...yard.strokes, { k, id: uid(), pts }] });
  };

  const onLabelAt = (p: Pt) => {
    setPendingLabel(p);
    setLabelText("");
  };
  const addLabel = () => {
    const text = labelText.trim().slice(0, MAX_LABEL);
    if (!pendingLabel || !text) return setPendingLabel(null);
    if (yard.strokes.length >= MAX_STROKES) {
      setPendingLabel(null);
      return say(`This sheet holds ${MAX_STROKES} strokes. Start a second yard.`);
    }
    commit({ ...yard, strokes: [...yard.strokes, { k: "label", id: uid(), at: pendingLabel, text }] });
    setPendingLabel(null);
  };

  const onMove = (u: string, p: Pt) =>
    commit({
      ...yard,
      plants: yard.plants.map((pl) => (pl.uid === u ? { ...pl, x: p[0], y: p[1] } : pl)),
    });
  const onNorth = (deg: number) => commit({ ...yard, north: deg });
  const onRing = (u: string, r: number) =>
    commit({ ...yard, plants: yard.plants.map((pl) => (pl.uid === u ? { ...pl, r } : pl)) });

  const removePlaced = (u: string) => {
    setSel(null);
    commit({ ...yard, plants: yard.plants.filter((pl) => pl.uid !== u) });
  };

  const rename = (name: string) => {
    const clean = name.trim().slice(0, 80);
    if (clean && clean !== yard.name) commit({ ...yard, name: clean });
  };

  /* ---- selected plant sheet ------------------------------------------- */

  const selected = sel ? yard.plants.find((pl) => pl.uid === sel) : null;
  const selPlant = selected ? byId.get(selected.id) : undefined;

  const keptPlants = kept
    .map((k) => byId.get(k.id))
    .filter((p): p is Plant => p !== undefined);

  /* ---- the tray: her shortlist by default, the whole guide on request --- */

  // The same index the omnibox reads, so "mouse melon" places Melothria
  // scabra here too. Keeping was never a requirement of placing; it was only
  // ever the tray's source, and now it is the tray's default instead.
  const finding = findText.trim().length >= 2;
  const found: Plant[] = finding
    ? state.data.index
        .search(findText, { prefix: true, fuzzy: 0.15, combineWith: "AND" })
        .slice(0, 12)
        .map((r) => byId.get(r.id as number))
        .filter((p): p is Plant => p !== undefined)
    : [];

  const tray = (p: Plant) => (
    <button
      key={p.id}
      className={armedId === p.id ? "yard-plant on" : "yard-plant"}
      onClick={() => setArmedId(armedId === p.id ? null : p.id)}
      aria-pressed={armedId === p.id}
    >
      <span className="yard-plant-thumb">
        <Thumb id={p.id} has={!!p.thumb} sizes="32px" />
      </span>
      {short(p.name)}
    </button>
  );

  return (
    <div className="page wrap yard">
      <div className="detail-top">
        <Link to="/yards" className="back-link">
          <IconChevronLeft width={18} height={18} />
          Yards
        </Link>
      </div>

      <header className="yard-head">
        <input
          className="yard-title"
          defaultValue={yard.name}
          aria-label="Yard name"
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <button
          className="btn btn--sm"
          onClick={() => exportYard(yard, tokens, { slot, bloomLine, placedPlants })}
        >
          Share
        </button>
      </header>

      {!saved && (
        <div className="callout callout--warn" style={{ marginTop: "var(--sp-2)" }}>
          <span>
            This phone's storage refused the last save; the sketch lives in this session only.
            Free some space, then touch the sketch again.
          </span>
        </div>
      )}

      {placed > 0 && (
        <div className="seg yard-viewseg" role="group" aria-label="Projection">
          {(
            [
              ["sheet", "Sheet"],
              ["elevation", "Elevation"],
              ["model", "Model"],
            ] as ["sheet" | "elevation" | "model", string][]
          ).map(([v, label]) => (
            <button
              key={v}
              aria-pressed={projection === v}
              className={projection === v ? "on" : ""}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {projection === "sheet" ? (
        <YardCanvas
          yard={yard}
          underlay={underlayUrl}
          tokens={tokens}
          mode={mode}
          sel={sel}
          armed={armedId !== null}
          onPlace={onPlace}
          onLabelAt={onLabelAt}
          onStroke={onStroke}
          onSelect={setSel}
          onMove={onMove}
          onNorth={onNorth}
          onRing={onRing}
        />
      ) : projection === "elevation" ? (
        <ElevationView figs={figs} sel={sel} onSelect={setSel} />
      ) : (
        <Suspense fallback={<p className="yard-coverage">Raising the model…</p>}>
          <YardModel yard={yard} figs={figs} underlay={underlayUrl} sel={sel} onSelect={setSel} />
        </Suspense>
      )}
      {elevLine && <p className="yard-coverage">{elevLine}</p>}
      {projection === "model" && (
        <p className="yard-coverage">
          The ground is your sheet and claims no scale; heights are true to one another, and the
          corner post is the tallest plant's measure. Drag to walk around it.
        </p>
      )}

      {placed > 0 && <YearScrubber slot={slot} onSlot={setSlot} />}
      {bloomLine && <p className="yard-coverage">{bloomLine}</p>}

      {placed > 0 && (askFunctions.length > 0 || askVisitors.length > 0 || askLayers.length > 0) && (
        <div className="yard-ask">
          <select
            className="yard-ask-select"
            value={show}
            onChange={(e) => setShow(e.target.value)}
            aria-label="Ring the plants recorded for"
          >
            <option value="">Ask the yard…</option>
            {askFunctions.length > 0 && (
              <optgroup label="Function">
                {askFunctions.map((v) => (
                  <option key={v} value={`functions:${v}`}>
                    {v}
                  </option>
                ))}
              </optgroup>
            )}
            {askVisitors.length > 0 && (
              <optgroup label="Visitors">
                {askVisitors.map((v) => (
                  <option key={v} value={`attracts:${v}`}>
                    {v}
                  </option>
                ))}
              </optgroup>
            )}
            {askLayers.length > 0 && (
              <optgroup label="Layer">
                {askLayers.map((v) => (
                  <option key={v} value={`layer:${v}`}>
                    {v}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {showLine && <p className="yard-coverage">{showLine}</p>}
        </div>
      )}

      {projection === "sheet" && (
      <>
      <div className="yard-tools">
        <div className="seg" role="group" aria-label="Tool">
          {(
            [
              ["move", "Move"],
              ["draw", "Draw"],
              ["area", "Bed"],
              ["label", "Label"],
              ["place", "Place"],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              aria-pressed={mode === m}
              className={mode === m ? "on" : ""}
              onClick={() => {
                setMode(m);
                setPendingLabel(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="btn btn--sm" onClick={undo} disabled={past.length === 0}>
          Undo
        </button>
      </div>

      <div className="yard-underlay-row">
        {/* No `capture` here, unlike the plant close-up: the picture of a yard
            is as likely to be in the gallery, shot from the porch, as taken on
            the spot, and capture would lock her out of choosing it. */}
        <input
          ref={pickGround}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void layGround(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => pickGround.current?.click()}
          disabled={laying}
        >
          {laying ? "Saving…" : yard.underlay ? "Replace the photo" : "Lay a photo under the sheet"}
        </button>
        {yard.underlay && (
          <>
            <button className="linkish note-delete" onClick={() => setUnderlay(undefined)}>
              Remove it
            </button>
            <span className="yard-coverage">Your photo, faded under the ink. Undo never touches it.</span>
          </>
        )}
      </div>
      </>
      )}

      {note && <p className="yard-note">{note}</p>}

      {projection === "sheet" && mode === "label" && pendingLabel && (
        <div className="yard-labelrow">
          <input
            className="note-input"
            style={{ padding: "var(--sp-1) var(--sp-2)" }}
            value={labelText}
            autoFocus
            maxLength={MAX_LABEL}
            placeholder="shed, wet corner, gate…"
            onChange={(e) => setLabelText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLabel()}
          />
          <button className="btn btn--primary btn--sm" onClick={addLabel}>
            Add
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setPendingLabel(null)}>
            Cancel
          </button>
        </div>
      )}

      {projection === "sheet" && mode === "place" && (
        <>
          <div className="yard-findrow">
            <input
              className="note-input"
              style={{ padding: "var(--sp-1) var(--sp-2)" }}
              value={findText}
              placeholder="Any plant in the guide…"
              aria-label="Find a plant to place"
              onChange={(e) => setFindText(e.target.value)}
            />
          </div>
          {finding ? (
            found.length > 0 ? (
              <div className="yard-tray">{found.map(tray)}</div>
            ) : (
              <p className="yard-coverage">Nothing in the guide answers to that.</p>
            )
          ) : keptPlants.length > 0 ? (
            <div className="yard-tray">{keptPlants.map(tray)}</div>
          ) : (
            <p className="yard-coverage">
              Type a name above; any plant in the guide places. Plants you{" "}
              <Link to="/">Keep</Link> wait here as a tray.
            </p>
          )}
        </>
      )}
      {projection === "sheet" && mode === "place" && armedId !== null && (
        <p className="yard-coverage">Tap the sheet to place. Tap again for a drift.</p>
      )}

      {selected && (
        <section className="panel yard-sheet">
          <div className="yard-sheet-head">
            <div>
              {selPlant ? (
                <Link to={`/plant/${selPlant.slug}`} className="yard-sheet-name">
                  {selPlant.name}
                </Link>
              ) : (
                <span className="yard-sheet-name">{selected.name}</span>
              )}
              {selPlant?.scientificName && (
                <div className="binomial" style={{ fontSize: "var(--text-xs)" }}>
                  {selPlant.scientificName}
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={() => setSel(null)} aria-label="Close">
              <IconX width={16} height={16} />
            </button>
          </div>

          {!selPlant && (
            <p className="attr-absent">
              No longer in this copy of the guide; the mark keeps the name it was placed with.
            </p>
          )}
          {selPlant && (
            <>
              <div className="attr-row">
                <span className="attr-label">Bloom</span>
                {selPlant.bloomColor ? (
                  <span className="chip-row">
                    <span className="ptag">
                      {BLOOM_HEX[selPlant.bloomColor] && (
                        <span
                          className="swatch"
                          style={{ background: BLOOM_HEX[selPlant.bloomColor] }}
                          aria-hidden="true"
                        />
                      )}
                      {selPlant.bloomColor}
                    </span>
                    {selPlant.bloomPeriod && <span className="ptag">{bloomPeriodLabel(selPlant.bloomPeriod)}</span>}
                  </span>
                ) : (
                  // The same blank as the plant page's, so the same offer. She is
                  // standing over the bed with the sheet open; this is the likeliest
                  // place in the guide for her to know the answer.
                  <span className="chip-row">
                    {!mineFor(mine, selPlant.id, "bloomColor") && (
                      <span className="attr-absent">Not in our sources.</span>
                    )}
                    <AddMine
                      id={selPlant.id}
                      field="bloomColor"
                      label="Bloom colour"
                      value={mineFor(mine, selPlant.id, "bloomColor")?.text}
                    />
                  </span>
                )}
              </div>
              <div className="attr-row">
                <span className="attr-label">Visitors</span>
                {selPlant.attracts?.length ? (
                  <span>{selPlant.attracts.join(", ")}</span>
                ) : (
                  <span className="chip-row">
                    {!mineFor(mine, selPlant.id, "attracts") && (
                      <span className="attr-absent">No visitor in our sources.</span>
                    )}
                    <AddMine
                      id={selPlant.id}
                      field="attracts"
                      label="Flower visitors"
                      value={mineFor(mine, selPlant.id, "attracts")?.text}
                    />
                  </span>
                )}
              </div>
              <div className="attr-row">
                <span className="attr-label">Height</span>
                {selPlant.height != null ? (
                  <span>{selPlant.height} m</span>
                ) : (
                  // Elevation is where an unmeasured plant is felt: it stands
                  // on the line with no figure. The blank is offered here
                  // because this panel is open when she is looking at that.
                  <span className="chip-row">
                    {!mineFor(mine, selPlant.id, "height") && (
                      <span className="attr-absent">Not in our sources.</span>
                    )}
                    <AddMine
                      id={selPlant.id}
                      field="height"
                      label="Height"
                      value={mineFor(mine, selPlant.id, "height")?.text}
                    />
                  </span>
                )}
              </div>
              {selPlant.functions.length > 0 && (
                <div className="attr-row">
                  <span className="attr-label">Functions</span>
                  <span>{selPlant.functions.join(", ")}</span>
                </div>
              )}
              {selPlant.cautions && (
                <div className="callout callout--warn" style={{ marginTop: "var(--sp-2)" }}>
                  <span>
                    <b>Caution:</b> {selPlant.cautions}. Wording is Permapeople's.
                  </span>
                </div>
              )}
            </>
          )}

          <div className="yard-sheet-actions">
            {selected.r ? (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => commit({ ...yard, plants: yard.plants.map((pl) => (pl.uid === selected.uid ? { ...pl, r: undefined } : pl)) })}
              >
                Remove spacing ring
              </button>
            ) : (
              <button className="btn btn--ghost btn--sm" onClick={() => onRing(selected.uid, 60)}>
                Add spacing ring
              </button>
            )}
            {/* Both halves of this always showed nothing until she already had a
                ring, so the only way to learn the gesture was to have found it.
                A placement is a point on purpose (width is recorded for 3% of the
                catalogue), so "how do I resize this?" has an answer, and the panel
                has to be the thing that gives it. */}
            <span className="yard-coverage">
              {selected.r
                ? "Drag the ring's edge to resize it. Your estimate, not the record's."
                : "A placement is a point. Add a ring to give it a size of your own."}
            </span>
            <button className="linkish note-delete" onClick={() => removePlaced(selected.uid)}>
              Remove from sketch
            </button>
          </div>
        </section>
      )}

      <div className="yard-end">
        {confirmDelete ? (
          <>
            <span className="yard-coverage">Delete “{yard.name}” and its sketch?</span>
            <button
              className="btn btn--sm"
              style={{ color: "var(--danger)" }}
              onClick={() => {
                remove(yard.id);
                navigate("/yards");
              }}
            >
              Delete
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button className="linkish note-delete" onClick={() => setConfirmDelete(true)}>
            Delete this yard
          </button>
        )}
      </div>
    </div>
  );
}
