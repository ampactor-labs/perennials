import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Plant } from "@/data/model";
import { useDataState } from "@/data/store";
import { BLOOM_HEX, bloomPeriodLabel, bloomSlots, type BloomSlot } from "@/lib/bloom";
import { useKept } from "@/lib/kept";
import { latFromDevice, useLat, writeLat } from "@/lib/latitude";
import { mineFor, useMine } from "@/lib/mine";
import { deletePhoto, putPhoto, useMinePhoto } from "@/lib/photos";
import { ACCESS } from "@/lib/query";
import { seenSlots, useSeen } from "@/lib/seen";
import { outsideRecord, visitorGaps } from "@/lib/phenology";
import { useSpots } from "@/lib/spots";
import { layerGapsOf } from "@/lib/elevation";
import { parseLevel } from "@/lib/ground";
import { growthBand } from "@/lib/growth";
import {
  MAX_GROUND,
  MAX_LABEL,
  MAX_PLANTS,
  MAX_STROKES,
  type Pt,
  type Yard,
  useYards,
} from "@/lib/yards";
import { exportYard } from "@/lib/yardExport";
import { buildYardFile, yardFileText } from "@/lib/yardFile";
import { asList, bedLinesOf, figsOf, hoursAt, sceneOf, shadeImage, tokensOf } from "@/lib/yardViews";
import { lightTier, tierWord } from "@/lib/sun";
import { encodeConstraints } from "@/lib/constraints";
import { AddMine } from "@/components/AddMine";
import { BloomCalendar } from "@/components/BloomCalendar";
import { ElevationView } from "@/components/ElevationView";
import { SlotLinks } from "@/components/SlotLinks";
import { YardCanvas, type Mode } from "@/components/YardCanvas";
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

/** Solar time on the half hour, as the sliders speak it. */
const hourLabel = (h: number) => `${Math.floor(h)}:${h % 1 ? "30" : "00"}`;

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
  const { save: saveSpot } = useSpots();
  const lat = useLat();

  const [mode, setMode] = useState<Mode>("move");
  const [view, setView] = useState<"sheet" | "elevation" | "model">("sheet");
  const [armedId, setArmedId] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [slot, setSlot] = useState<BloomSlot | null>(null);
  const [show, setShow] = useState<string>("");
  const [pendingLabel, setPendingLabel] = useState<Pt | null>(null);
  const [labelText, setLabelText] = useState("");
  const [pendingGround, setPendingGround] = useState<{ at: Pt; id: string | null } | null>(null);
  const [groundText, setGroundText] = useState("");
  // The Ask tool's tapped point. Transient on purpose: a question is not a
  // mark, so it never touches the yard record.
  const [asked, setAsked] = useState<Pt | null>(null);
  // The plan's shade wash, off until she asks for it; play sweeps the hour
  // across the day so the shadow walks the sheet on its own.
  const [sunSheet, setSunSheet] = useState(false);
  const [hourPlay, setHourPlay] = useState(false);
  const [saved, setSaved] = useState(true);
  const [findText, setFindText] = useState("");
  const [years, setYears] = useState<number | null>(null);
  const [hour, setHour] = useState(14);
  const [walk, setWalk] = useState(false);
  const [latBusy, setLatBusy] = useState(false);
  const [latDraft, setLatDraft] = useState("");
  const [spanDraft, setSpanDraft] = useState("");
  const [past, setPast] = useState<Yard[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [laying, setLaying] = useState(false);
  const pickGround = useRef<HTMLInputElement>(null);

  const yard = yards.find((y) => y.id === id);
  const underlayUrl = useMinePhoto(yard?.underlay);
  const ready = state.status === "ready" ? state.data : null;

  /* ---- the derived views, memoized on their real inputs ----------------
     Identity is behaviour here: YardModel's scene effect keys on `figs`, so
     rebuilding these arrays on every render made a 4-second toast tear the
     whole three.js scene down twice, and the hour slider re-marched every
     bed's day for nothing. lib/yardViews.ts holds the work; these live above
     the early return so the hooks stay unconditional. */

  // Her kept plants, resolved once: the Place tray's default, and what the
  // sun checks each bed's light against.
  const keptPlants = useMemo(
    () =>
      ready
        ? kept.map((k) => ready.byId.get(k.id)).filter((p): p is Plant => p !== undefined)
        : [],
    [ready, kept],
  );
  const tokens = useMemo(
    () => (ready && yard ? tokensOf(yard, ready.byId, ready.mine, seen, slot, show) : []),
    [ready, yard, seen, slot, show],
  );
  const figs = useMemo(
    () => (ready && yard ? figsOf(yard, ready.byId, ready.mine, mine, tokens) : []),
    [ready, yard, mine, tokens],
  );
  // Null without her latitude and her span: the sun is never guessed.
  const scene = useMemo(
    () => (yard ? sceneOf(yard, figs, lat, slot, years) : null),
    [yard, figs, lat, slot, years],
  );

  // An empty yard has no side to see; the toggle appears once anything
  // stands — a plant, or ground she has shaped — and losing the last of
  // both lands her back on the paper. Shaping the land before planting it
  // is the honest order of the work, so the land alone earns the views.
  const standable = !!yard && (yard.plants.length > 0 || (yard.ground ?? []).length > 0);
  const projection = standable ? view : "sheet";

  const bedLines = useMemo(
    () =>
      ready && yard && projection === "model" && scene
        ? bedLinesOf(
            yard,
            scene,
            keptPlants,
            ready.mine,
            (ready.facets.light ?? []).map((v) => v.value),
          )
        : [],
    [ready, yard, projection, scene, keptPlants],
  );
  // The model's sun effect keys on this object; a fresh literal per render
  // made even the cheap light move fire on every unrelated state change.
  const sun = useMemo(
    () => (scene ? { lat: scene.lat, day: scene.day, hour } : null),
    [scene, hour],
  );

  // Play walks the hour across the day while the wash is on screen; the
  // interval dies with the toggle, the projection, or the button itself.
  useEffect(() => {
    if (!hourPlay || !sunSheet || projection !== "sheet") return;
    const t = window.setInterval(() => setHour((h) => (h >= 21 ? 5 : h + 0.5)), 450);
    return () => window.clearInterval(t);
  }, [hourPlay, sunSheet, projection]);

  // The plan's shade wash: this hour's sun over the whole sheet, one ray per
  // cell against the same crowns and land the bed lines march. Null while
  // the toggle is off, the scene is missing a number, or the sun is down.
  const shade = useMemo(
    () =>
      projection === "sheet" && sunSheet && scene && yard
        ? shadeImage(scene, yard.north, hour)
        : null,
    [projection, sunSheet, scene, yard, hour],
  );

  // The selected plant's spot, read by the same sun: computed hours beside
  // the recorded preference, neither called wrong — placement as feedback.
  const selFit = useMemo(() => {
    if (!ready || !yard || !scene || !sel) return null;
    const pl = yard.plants.find((x) => x.uid === sel);
    const p = pl && ready.byId.get(pl.id);
    if (!pl || !p) return null;
    const hours = hoursAt(pl.x, pl.y, scene, yard.north);
    const word = tierWord(
      (ready.facets.light ?? []).map((v) => v.value),
      lightTier(hours),
    );
    return { hours, word, recorded: asList(ACCESS.light(p, ready.mine.get(p.id))) };
  }, [ready, yard, scene, sel]);

  // The Ask tool's answer: the sun read at her tapped point, in the
  // catalogue's own light vocabulary. It follows the season scrub, because
  // the scene carries the slot's day. Null without a tap or without the two
  // numbers the sun needs; nothing is guessed.
  const askAnswer = useMemo(() => {
    if (!ready || !yard || !scene || !asked) return null;
    const hours = hoursAt(asked[0], asked[1], scene, yard.north);
    const word = tierWord(
      (ready.facets.light ?? []).map((v) => v.value),
      lightTier(hours),
    );
    return { hours, word };
  }, [ready, yard, scene, asked]);

  if (!ready || !yard) {
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
  const { byId, mine: herIndex } = ready;

  // The land she shaped, read once here so every projection stands each
  // plant on the same footing (lib/ground.ts is the one interpolator).
  const marks = yard.ground ?? [];

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
    // The mark that question was about may just have been un-drawn.
    setPendingGround(null);
  };

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
    const showValue = show.slice(show.indexOf(":") + 1);
    const m = tokens.filter((t) => t.show === "match").length;
    const u = tokens.filter((t) => t.show === "unrecorded").length;
    return `${m} of ${placed} recorded as ${showValue}${u > 0 ? `; ${u} not in our data` : ""}.`;
  })();

  /* ---- the sun: derived shade, only from numbers that are hers --------- */

  const sunReady = lat !== null && !!yard.span;

  const saveBedSpot = (b: { name: string; word: string }) => {
    saveSpot(`${b.name} (${(slot ?? "Early Summer").toLowerCase()} sun)`, {
      atoms: [{ kind: "facet", key: "light", value: b.word }],
      text: "",
      view: "list",
    });
    say(`Saved "${b.name}" to your spots; it applies like any site.`);
  };

  // The place itself becomes the search: the derived word applies as an
  // ordinary Light ask, so the trail shows it like any constraint of hers.
  // Her zone deliberately does not ride along — homeZone starts at 6 without
  // her ever saying so, and a filter is a stronger claim than a sort; the
  // rail offers her zone one tap away.
  const openInGuide = (word: string) =>
    navigate(
      `/?${encodeConstraints({
        atoms: [{ kind: "facet", key: "light", value: word }],
        text: "",
        view: "list",
      }).toString()}`,
    );

  // A missing stratum's name opens that shelf of the guide, stacked the way
  // the forest garden stacks it.
  const layerTo = (l: string) =>
    `/?${encodeConstraints({
      atoms: [{ kind: "facet", key: "layer", value: l }],
      text: "",
      view: "guild",
    }).toString()}`;

  // The asked point saves like a bed does, named by the nearest label when
  // one is close enough to be its name.
  const saveAskSpot = () => {
    if (!asked || !askAnswer) return;
    let name = "Asked point";
    let best = 300;
    for (const l of yard.strokes) {
      if (l.k !== "label") continue;
      const d = Math.hypot(l.at[0] - asked[0], l.at[1] - asked[1]);
      if (d < best) {
        best = d;
        name = l.text;
      }
    }
    saveSpot(`${name} (${(slot ?? "Early Summer").toLowerCase()} sun)`, {
      atoms: [{ kind: "facet", key: "light", value: askAnswer.word }],
      text: "",
      view: "list",
    });
    say(`Saved "${name}" to your spots; it applies like any site.`);
  };

  const askLat = async () => {
    setLatBusy(true);
    const v = await latFromDevice();
    setLatBusy(false);
    if (v === null) return say("This phone won't say where it is; type your latitude instead.");
    if (!writeLat(v)) say("This phone's storage refused the save.");
  };
  const setLatManual = () => {
    const n = Number(latDraft);
    if (!Number.isFinite(n) || Math.abs(n) > 90 || latDraft.trim() === "")
      return say("A latitude runs from -90 to 90.");
    writeLat(n);
    setLatDraft("");
  };
  const setSpanManual = () => {
    const n = Number(spanDraft);
    if (!Number.isFinite(n) || n < 2 || n > 2000 || spanDraft.trim() === "")
      return say("A sheet spans a couple of metres to a couple of thousand.");
    commit({ ...yard, span: Math.round(n) });
    setSpanDraft("");
  };

  // The years axis: how many growing figures actually have a recorded pace.
  const paceLine = (() => {
    if (years === null || projection === "sheet") return null;
    const growing = figs.filter((f) => f.height !== null);
    if (growing.length === 0) return null;
    const paced = growing.filter((f) => growthBand(f.growth, 1) !== null).length;
    const rest = growing.length - paced;
    return `${paced} of ${growing.length} figures have a recorded pace and grow between a cautious and a generous reading of it${rest > 0 ? `; ${rest} stand at mature size, their pace not in our data` : ""}.`;
  })();

  // The ground's own coverage: how many heights shape it, and what the
  // surface between them claims. Printed under every view that draws the
  // shape; the sheet's Ground tool carries its own working hint instead.
  const groundLine =
    marks.length > 0 && projection !== "sheet"
      ? `The ground bends through the ${marks.length === 1 ? "one height" : `${marks.length} heights`} you set and settles level where you set none — your estimate, not a survey.`
      : null;

  const elevLine = (() => {
    if (projection === "sheet" || placed === 0) return null;
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

  /* ---- the almanac: this yard's year, on the calendar's own axis -------- */

  // A plant placed twice is one row of the year, not two.
  const almanacPlants = [...new Map(placedPlants.map((p) => [p.id, p])).values()];

  // The pollinator famine, coverage first. With visitors recorded for nobody
  // the gaps list means only "no visitor data", so the coverage sentence
  // stands alone rather than dressing that silence up as a famine. Each
  // famine slot links into the guide: a named gap becomes a gap to shop.
  const visitorLine = (() => {
    if (almanacPlants.length === 0) return null;
    const vg = visitorGaps(almanacPlants, herIndex, seen);
    const cover = `Visitors are recorded for ${vg.covered} of ${vg.of} placed ${vg.of === 1 ? "plant" : "plants"}.`;
    if (vg.covered === 0 || vg.gaps.length === 0) return cover;
    return (
      <>
        {cover} In <SlotLinks slots={vg.gaps} />, nothing recorded in bloom here has a
        recorded flower visitor.
      </>
    );
  })();

  // Which strata nobody here carries, and how many placed plants carry no
  // layer at all: two different silences, never merged. Each missing layer's
  // name opens that shelf of the guide.
  const layerGaps =
    almanacPlants.length > 0
      ? layerGapsOf(
          almanacPlants.map((p) => asList(ACCESS.layer(p, herIndex.get(p.id)))),
        )
      : null;

  // Her marks against the record, over the whole yard: neither side wrong,
  // same bargain as the per-plant line, said once.
  const outranLine = (() => {
    const n = almanacPlants.filter(
      (p) => outsideRecord(seenSlots(seen, p.id), bloomSlots(p.bloomPeriod)).length > 0,
    ).length;
    return n > 0
      ? `Your marks put ${n === 1 ? "one plant" : `${n} plants`} in bloom outside the printed band — your yard teaching the record.`
      : null;
  })();
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

  // Her heights. A tap on paper asks for a new one; a tap on a mark reopens
  // it, prefilled, with Remove on offer; a drag moves it and its number rides
  // along. All whole-yard commits, so undo un-draws the land like ink.
  const onGroundAt = (p: Pt, id: string | null) => {
    if (id) {
      const gm = marks.find((g) => g.id === id);
      if (!gm) return;
      setPendingGround({ at: gm.at, id });
      setGroundText(String(gm.m));
      return;
    }
    if (marks.length >= MAX_GROUND) {
      return say(`This sheet holds ${MAX_GROUND} heights. Move one, or remove one you can spare.`);
    }
    setPendingGround({ at: p, id: null });
    setGroundText("");
  };

  const addGround = () => {
    if (!pendingGround) return;
    const m = parseLevel(groundText);
    if (m === null) {
      return say("A height is metres up or down from your zero: 1.5, -0.5, 60 cm.");
    }
    commit({
      ...yard,
      ground: pendingGround.id
        ? marks.map((g) => (g.id === pendingGround.id ? { ...g, m } : g))
        : [...marks, { id: uid(), at: pendingGround.at, m }],
    });
    setPendingGround(null);
  };

  const removeGround = () => {
    if (pendingGround?.id) {
      const rest = marks.filter((g) => g.id !== pendingGround.id);
      const { ground: _gone, ...bare } = yard;
      commit(rest.length ? { ...bare, ground: rest } : bare);
    }
    setPendingGround(null);
  };

  const onGroundMove = (id: string, p: Pt) =>
    commit({ ...yard, ground: marks.map((g) => (g.id === id ? { ...g, at: p } : g)) });

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

  /* ---- the tray: her shortlist by default, the whole guide on request --- */

  // The same index the omnibox reads, so "mouse melon" places Melothria
  // scabra here too. Keeping was never a requirement of placing; it was only
  // ever the tray's source, and now it is the tray's default instead.
  const finding = findText.trim().length >= 2;
  const found: Plant[] = finding
    ? ready.index
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

  // The two numbers the sun needs, asked for wherever the sun is wanted: the
  // model's sun section and the sheet's Ask tool share this one form.
  const sunNeeds = (
    <>
      <p className="yard-coverage">
        The sun needs two numbers of yours: your latitude, and about how many metres this
        sheet spans. Nothing is cast without them, and nothing is guessed.
      </p>
      {lat === null ? (
        <div className="yard-sun-row">
          <button className="btn btn--ghost btn--sm" disabled={latBusy} onClick={() => void askLat()}>
            {latBusy ? "Asking…" : "Use where I'm standing"}
          </button>
          <input
            className="note-input yard-sun-input"
            inputMode="numeric"
            value={latDraft}
            placeholder="or latitude, e.g. 43"
            aria-label="Your latitude in degrees"
            onChange={(e) => setLatDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setLatManual()}
          />
          <button className="btn btn--sm" onClick={setLatManual}>
            Set
          </button>
          <span className="yard-coverage">Kept to the whole degree; the sun can't tell finer.</span>
        </div>
      ) : (
        <p className="yard-coverage">Latitude {lat}°.</p>
      )}
      {!yard.span && (
        <div className="yard-sun-row">
          <input
            className="note-input yard-sun-input"
            inputMode="numeric"
            value={spanDraft}
            placeholder="sheet width in metres"
            aria-label="About how many metres across is this sheet"
            onChange={(e) => setSpanDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSpanManual()}
          />
          <button className="btn btn--sm" onClick={setSpanManual}>
            Set
          </button>
          <span className="yard-coverage">Your estimate; it also puts the model to scale.</span>
        </div>
      )}
    </>
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
          onClick={async () =>
            exportYard(yard, tokens, {
              slot,
              bloomLine,
              placedPlants,
              mine: herIndex,
              figs,
              yardFile: yardFileText(await buildYardFile(yard)),
              // The sheet exports what it shows: the wash rides only while
              // she has it drawn, with the hour and the basis in the footer.
              shade:
                shade !== null
                  ? {
                      url: shade.url,
                      line: `Shade at ${hourLabel(hour)}, ${(slot ?? "Early Summer").toLowerCase()} — from your latitude, span, crowns and land.`,
                    }
                  : null,
            })
          }
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

      {standable && (
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
          groundSel={pendingGround?.id ?? null}
          onGround={onGroundAt}
          onGroundMove={onGroundMove}
          askAt={mode === "ask" ? asked : null}
          onAsk={setAsked}
          shade={shade?.url ?? null}
        />
      ) : projection === "elevation" ? (
        <ElevationView figs={figs} ground={marks} sel={sel} years={years} onSelect={setSel} />
      ) : (
        <Suspense fallback={<p className="yard-coverage">Raising the model…</p>}>
          <YardModel
            yard={yard}
            figs={figs}
            underlay={underlayUrl}
            sel={sel}
            years={years}
            sun={sun}
            walk={walk}
            onSelect={setSel}
          />
        </Suspense>
      )}
      {elevLine && <p className="yard-coverage">{elevLine}</p>}
      {groundLine && <p className="yard-coverage">{groundLine}</p>}

      {/* The sheet's workbench rides directly under the paper: switching
          tools, laying the photo, and answering a tool's question all happen
          where the thumb already is, not below the year scrubber. The
          reading controls — the scrubber, the ask — follow after. */}
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
                  ["ground", "Ground"],
                  ["ask", "Ask"],
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
                    setPendingGround(null);
                    setAsked(null);
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

          {mode === "label" && pendingLabel && (
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

          {mode === "ground" && pendingGround && (
            <div className="yard-labelrow">
              <input
                className="note-input"
                style={{ padding: "var(--sp-1) var(--sp-2)" }}
                value={groundText}
                autoFocus
                placeholder="metres up or down: 1.5, -0.5, 60 cm…"
                aria-label="Height at this spot, in metres"
                onChange={(e) => setGroundText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGround()}
              />
              <button className="btn btn--primary btn--sm" onClick={addGround}>
                {pendingGround.id ? "Save" : "Set"}
              </button>
              {pendingGround.id && (
                <button className="linkish note-delete" onClick={removeGround}>
                  Remove
                </button>
              )}
              <button className="btn btn--ghost btn--sm" onClick={() => setPendingGround(null)}>
                Cancel
              </button>
            </div>
          )}
          {mode === "ground" && !pendingGround && (
            <p className="yard-coverage">
              {marks.length === 0
                ? "Tap where you know a rise or a dip and give it a height in metres; 0 is the level you stand on. A few heights shape the whole ground, and the side and model views stand on it."
                : "Tap paper for a new height, a triangle to change or remove one, or drag it to move it."}
            </p>
          )}

          {mode === "ask" &&
            (!sunReady ? (
              sunNeeds
            ) : asked && askAnswer ? (
              <>
                <p className="yard-coverage">
                  About {askAnswer.hours}h direct here in{" "}
                  {(slot ?? "Early Summer").toLowerCase()} — reads as {askAnswer.word}. Computed
                  from your sheet: your latitude, your span, crowns and land as recorded.
                </p>
                <div className="yard-labelrow">
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => openInGuide(askAnswer.word)}
                  >
                    Open in the guide
                  </button>
                  <button className="btn btn--sm" onClick={saveAskSpot}>
                    Save as spot
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setAsked(null)}>
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <p className="yard-coverage">
                Tap any spot and the sun reads it: hours of direct light in{" "}
                {(slot ?? "Early Summer").toLowerCase()}, in the guide's own words, ready to
                search with. Scrub the year and the answer follows.
              </p>
            ))}

          {mode === "place" && (
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
              {armedId !== null && (
                <p className="yard-coverage">Tap the sheet to place. Tap again for a drift.</p>
              )}
            </>
          )}

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

          {/* The shade wash: the model's sun, read flat onto the plan. Only
              offered once both her numbers exist; the Ask tool teaches what
              the sun needs before then. */}
          {sunReady && (
            <>
              <div className="yard-sun-row">
                <button
                  className={sunSheet ? "btn btn--sm" : "btn btn--ghost btn--sm"}
                  aria-pressed={sunSheet}
                  onClick={() => setSunSheet((v) => !v)}
                >
                  {sunSheet ? "Hide the shade" : "Draw the shade"}
                </button>
                {sunSheet && (
                  <>
                    <input
                      className="yard-slider"
                      type="range"
                      min={5}
                      max={21}
                      step={0.5}
                      value={hour}
                      aria-label="Hour of the day, solar time"
                      onChange={(e) => {
                        setHourPlay(false);
                        setHour(Number(e.target.value));
                      }}
                    />
                    <span className="yard-coverage yard-years-label">
                      {`${hourLabel(hour)} · ${slot ?? "Early Summer"}`}
                    </span>
                    <button
                      className={hourPlay ? "scrub-play on" : "scrub-play"}
                      onClick={() => setHourPlay((p) => !p)}
                      aria-pressed={hourPlay}
                      aria-label={hourPlay ? "Stop the day" : "Play the day"}
                    >
                      {hourPlay ? "◼" : "▶"}
                    </button>
                  </>
                )}
              </div>
              {sunSheet && (
                <p className="yard-coverage">
                  {shade
                    ? `Shade washed where this hour's sun doesn't reach — about ${Math.round((1 - shade.litFrac) * 100)}% of the sheet. Computed from yours: latitude, span, crowns and land as recorded.`
                    : "The sun is down at this hour; nothing is washed."}
                </p>
              )}
            </>
          )}
        </>
      )}

      {note && <p className="yard-note">{note}</p>}

      {projection === "model" && (
        <div className="yard-sun-row">
          <p className="yard-coverage" style={{ flex: 1, minWidth: 0, marginTop: 0 }}>
            {yard.span
              ? `The ground is your sheet at the span you gave it, about ${yard.span} m across; heights${marks.length ? ", the land's included," : ""} stand in the same metres.`
              : "The ground is your sheet and claims no scale; heights are true to one another, and the corner post carries the tallest measure."}
          </p>
          <button
            className={walk ? "btn btn--sm" : "btn btn--ghost btn--sm"}
            onClick={() => setWalk((v) => !v)}
            aria-pressed={walk}
          >
            {walk ? "Look from above" : "Walk in"}
          </button>
        </div>
      )}

      {projection !== "sheet" && placed > 0 && (
        <div className="yard-years">
          <button
            className={years === null ? "btn btn--sm" : "btn btn--ghost btn--sm"}
            onClick={() => setYears(null)}
            aria-pressed={years === null}
          >
            Mature
          </button>
          <input
            className="yard-slider"
            type="range"
            min={0}
            max={25}
            step={1}
            value={years ?? 25}
            aria-label="Years since planting"
            onChange={(e) => setYears(Number(e.target.value))}
          />
          <span className="yard-coverage yard-years-label">
            {years === null ? "at recorded mature size" : years === 0 ? "the year it goes in" : `year ${years}`}
          </span>
        </div>
      )}
      {paceLine && <p className="yard-coverage">{paceLine}</p>}

      {projection === "model" && (
        <section className="yard-sun">
          {!sunReady ? (
            sunNeeds
          ) : (
            <>
              <div className="yard-sun-row">
                <input
                  className="yard-slider"
                  type="range"
                  min={5}
                  max={21}
                  step={0.5}
                  value={hour}
                  aria-label="Hour of the day, solar time"
                  onChange={(e) => setHour(Number(e.target.value))}
                />
                <span className="yard-coverage yard-years-label">
                  {`${hourLabel(hour)} · ${slot ?? "Early Summer"} sun at ${lat}°`}
                </span>
              </div>
              {bedLines.map((b) => (
                <p key={b.id} className="yard-coverage yard-bed-line">
                  <b>{b.name}</b>: about {b.hours}h direct — {b.word}.
                  {keptPlants.length > 0 && ` ${b.fit} of your kept plants are recorded for it.`}{" "}
                  <button className="linkish" onClick={() => openInGuide(b.word)}>
                    Open in the guide
                  </button>{" "}
                  <button className="linkish" onClick={() => saveBedSpot(b)}>
                    Save as spot
                  </button>
                </p>
              ))}
              {bedLines.length === 0 && (
                <p className="yard-coverage">Draw a bed on the sheet and the sun will read it.</p>
              )}
              <p className="yard-coverage">
                {marks.length
                  ? "Crowns and the land as you drew them, heights as recorded, sampled on the half hour: an estimate for planning a bed, not a survey."
                  : "Crowns as drawn, heights as recorded, sampled on the half hour: an estimate for planning a bed, not a survey."}
              </p>
            </>
          )}
        </section>
      )}

      {placed > 0 && <YearScrubber slot={slot} onSlot={setSlot} />}
      {bloomLine && <p className="yard-coverage">{bloomLine}</p>}

      {/* The almanac: the same wheel the kept list reads, over what stands
          here — the printed bands, her marks above them, and the year's gaps
          named. The famine and divergence lines ride under it, each scoped
          to what our data can actually claim. */}
      {almanacPlants.length > 0 && (
        <>
          <BloomCalendar plants={almanacPlants} context="yard" />
          {visitorLine && <p className="yard-coverage">{visitorLine}</p>}
          {outranLine && <p className="yard-coverage">{outranLine}</p>}
        </>
      )}

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

      {/* The guild's marginalia: which strata nobody here carries. A plant
          with no recorded layer is its own count, never evidence of a gap. */}
      {layerGaps && (
        <p className="yard-coverage">
          {layerGaps.missing.length === 0
            ? "Every guild layer has a plant recorded for it here."
            : [
                "No placed plant is recorded as ",
                ...layerGaps.missing.map((l, i) => (
                  <span key={l}>
                    {i > 0 &&
                      (i === layerGaps.missing.length - 1
                        ? layerGaps.missing.length > 2
                          ? ", or "
                          : " or "
                        : ", ")}
                    <Link to={layerTo(l)}>{l}</Link>
                  </span>
                )),
                " — each name opens that layer of the guide",
              ]}
          {layerGaps.unrecorded > 0 &&
            `; ${layerGaps.unrecorded} placed ${layerGaps.unrecorded === 1 ? "plant carries" : "plants carry"} no layer in our data`}
          .
        </p>
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
              {selFit && (
                <p className="yard-coverage" style={{ marginTop: "var(--sp-2)" }}>
                  About {selFit.hours}h direct at this mark in{" "}
                  {(slot ?? "Early Summer").toLowerCase()}, computed from your sheet — reads as{" "}
                  {selFit.word}.{" "}
                  {selFit.recorded.length > 0
                    ? `The record lists ${selFit.recorded.join(", ")}.`
                    : "No light preference in our sources."}
                </p>
              )}
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
