import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { archetypeOf, CROWN_RATIO } from "@/lib/elevation";
import { groundAt, groundRange, levelLabel } from "@/lib/ground";
import { speckle } from "@/lib/paper";
import { getPhoto } from "@/lib/photos";
import { sunAt } from "@/lib/sun";
import { pathD, SHEET_H, SHEET_W, type Yard } from "@/lib/yards";
import { grownM, type Fig } from "@/lib/yardViews";

/**
 * The model: the sheet laid over her land and the record standing on it, in
 * the round.
 *
 * Every rule the elevation keeps holds here, because the third projection is
 * not a third vocabulary. The ground IS her sheet: the same paper, her ink
 * and her washed photo drawn onto its texture — and when she has shaped the
 * land (lib/ground.ts), the sheet drapes over that shape: the same surface
 * the elevation sections, at the same metres, with every figure standing at
 * its own footing. A yard she never shaped lies flat, exactly as it always
 * did. A plant with no height in our data is a flat mark on the ground,
 * never a body; figures are the layer's archetype at the record's height,
 * in her ink when the measurement is hers; bloom colour is the only
 * saturated thing in the scene.
 *
 * Three things the sheet cannot do live here. The years axis grows each figure
 * along its recorded pace, drawing today solid with mature behind it as a
 * ghost. When she has given the sheet a span in metres, the ground stands at
 * true scale and her latitude casts the real sun across it, so the shade she
 * is told about in the bed lines is the shadow she can see. And where she has
 * photographed a plant the guide has none for, her own photo stands up in its
 * place, because a photograph of her plant beats any archetype of its kind.
 *
 * three.js arrives only when this mounts (the yard route lazy-loads it), so
 * the guide's first paint pays nothing for the third dimension.
 */

const HALF_W = SHEET_W / 2;
const HALF_H = SHEET_H / 2;
const TOP_UNITS = 480; // the tallest figure, in sheet units, when there is no span
const RAD = Math.PI / 180;
const EYE_M = 1.6; // eye height, metres, for the walk-in view

const cssColor = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** What the render pass dresses each frame: standees turned to face the
 *  eye, and name sprites stepped back with distance so the walk-in view is
 *  a garden rather than a label cloud. The build effect fills these; the
 *  stage's render() reads them. */
type Dress = {
  billboards: { group: THREE.Group; at: THREE.Vector3 }[];
  /** w/h are the sprite's authored size; the render pass scales from them. */
  labels: { sprite: THREE.Sprite; at: THREE.Vector3; w: number; h: number }[];
};

type World = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  sunLight: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
  dress: Dress;
  render: () => void;
};

export type SunInput = { lat: number; day: number; hour: number };

export function YardModel({
  yard,
  figs,
  underlay,
  sel,
  years,
  sun,
  walk,
  onSelect,
}: {
  yard: Yard;
  figs: Fig[];
  /** A live URL for her ground photo, or null; drawn washed into the sheet. */
  underlay: string | null;
  sel: string | null;
  /** Years since planting, or null for the mature view. */
  years: number | null;
  /** Her latitude and the day/hour, or null when the sheet has no span or she
   *  has not said where she is. Null means no shadow is cast and none faked. */
  sun: SunInput | null;
  /** Eye-level view from the sheet's edge, for the day the yard is only paper. */
  walk: boolean;
  onSelect: (uid: string | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const [failed, setFailed] = useState(false);
  // The scene bakes CSS colours at build time; when the theme moves (her
  // toggle, or the system at dusk) this tick pokes a rebuild so the model
  // repaints in the new ink instead of holding yesterday's.
  const [themeTick, setThemeTick] = useState(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const scaleFor = () => {
    const measured = figs.filter((f) => f.height !== null);
    const maxM = measured.length ? Math.max(...measured.map((f) => f.height!)) : 0;
    // With no span, the tallest measured thing — plant or landform — takes
    // the top of the scene, and the corner post says its metres; everything
    // else stays true to it. The same bargain as ever, now shared with the
    // ground.
    const range = groundRange(yard.ground);
    const tallest = Math.max(maxM, range.max, -range.min);
    const K = yard.span ? 1000 / yard.span : tallest > 0 ? TOP_UNITS / tallest : 0;
    return { K, tallest };
  };

  /* ---- the stage, once ------------------------------------------------- */

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      // No WebGL is a fact about the phone, not a bug to hide: say so.
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cssColor("--paper"));

    const camera = new THREE.PerspectiveCamera(42, 1, 5, 40000);
    camera.position.set(650, 620, 1500);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 90, 0);
    // She orbits and zooms; she never goes under the lawn or off to infinity.
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 60;
    controls.maxDistance = 6000;
    controls.enablePan = false;

    const ambient = new THREE.HemisphereLight(0xffffff, new THREE.Color(cssColor("--paper")), 1.0);
    scene.add(ambient);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(600, 900, 400);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.bias = -0.0006;
    const sc = sunLight.shadow.camera;
    sc.near = 100;
    sc.far = 12000;
    sc.left = -1200;
    sc.right = 1200;
    sc.top = 1400;
    sc.bottom = -1400;
    sc.updateProjectionMatrix();
    scene.add(sunLight);
    scene.add(sunLight.target);

    const content = new THREE.Group();
    scene.add(content);

    // On-demand rendering: a continuous loop would idle her battery flat.
    // The dressing pass rides inside it: photo standees turn to face the
    // eye, and far names step back relative to how far she is looking.
    const dress: Dress = { billboards: [], labels: [] };
    const render = () => {
      const cam = camera.position;
      const camDist = cam.distanceTo(controls.target) || 1;
      for (const b of dress.billboards) {
        b.group.rotation.y = Math.atan2(cam.x - b.at.x, cam.z - b.at.z);
      }
      for (const l of dress.labels) {
        const d = cam.distanceTo(l.at);
        const ratio = d / camDist;
        (l.sprite.material as THREE.SpriteMaterial).opacity = Math.max(
          0.05,
          Math.min(1, 1 - (ratio - 1.15) / 0.9),
        );
        // A sprite is world-sized, so at eye level a near name would fill
        // the walk-in view: hold it to its share of the screen instead. The
        // 1100 floor leaves the top-down view untouched — its labels all sit
        // farther than that.
        const s = Math.min(1, d / 1100);
        l.sprite.scale.set(l.w * s, l.h * s, 1);
      }
      renderer.render(scene, camera);
    };
    controls.addEventListener("change", render);

    const size = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(size);
    ro.observe(el);
    size();

    // A tap selects; a drag is the camera's. The 8px threshold is the same
    // dead-band the sheet uses to tell a tap from a token drag.
    let down: [number, number] | null = null;
    const onDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const onUp = (e: PointerEvent) => {
      const from = down;
      down = null;
      if (!from || Math.hypot(e.clientX - from[0], e.clientY - from[1]) > 8) return;
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      for (const hit of ray.intersectObjects(content.children, true)) {
        let o: THREE.Object3D | null = hit.object;
        while (o) {
          if (typeof o.userData.uid === "string") {
            onSelectRef.current(o.userData.uid);
            return;
          }
          o = o.parent;
        }
      }
      onSelectRef.current(null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // Watch both theme signals: her toggle stamps data-theme on the root,
    // and the system flips prefers-color-scheme on its own schedule.
    const mo = new MutationObserver(() => setThemeTick((t) => t + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => setThemeTick((t) => t + 1);
    scheme.addEventListener("change", onScheme);

    world.current = { renderer, scene, camera, controls, content, sunLight, ambient, dress, render };
    return () => {
      ro.disconnect();
      mo.disconnect();
      scheme.removeEventListener("change", onScheme);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      world.current = null;
    };
  }, []);

  /* ---- the yard, rebuilt when it changes -------------------------------- */

  useEffect(() => {
    const w = world.current;
    if (!w) return;
    let dead = false;
    const junk: { dispose(): void }[] = [];
    const urls: string[] = [];
    const keep = <T extends { dispose(): void }>(t: T): T => {
      junk.push(t);
      return t;
    };

    const paper = cssColor("--paper");
    const paperRaised = cssColor("--paper-raised");
    const paperSunk = cssColor("--paper-sunk");
    const lineCol = cssColor("--line");
    const ink = cssColor("--ink");
    const inkSoft = cssColor("--ink-soft");
    const inkFaint = cssColor("--ink-faint");
    const sepia = cssColor("--sepia");
    const green = cssColor("--green");
    const pc = new THREE.Color(paper);
    // Dark theme: lift the sheet one paper step so ink and shadow still read
    // against it, and let the sun push a little harder (see the sun effect).
    const isDark = (pc.r + pc.g + pc.b) / 3 < 0.5;

    // The stage is a page: past the sheet the scene fades back into the
    // paper it is drawn on. The sun effect keeps the fog's colour in step
    // with the sky it sets.
    w.scene.fog = new THREE.Fog(new THREE.Color(paper), 3600, 10000);

    // Fresh dressing per build; render() reads these live.
    w.dress.billboards.length = 0;
    w.dress.labels.length = 0;

    /* the ground is her sheet: paper, washed photo, her ink, as a texture */
    const sheet = document.createElement("canvas");
    sheet.width = SHEET_W;
    sheet.height = SHEET_H;
    const g = sheet.getContext("2d")!;
    const tex = keep(new THREE.CanvasTexture(sheet));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const paint = (img: HTMLImageElement | null) => {
      g.clearRect(0, 0, SHEET_W, SHEET_H);
      g.fillStyle = isDark ? paperRaised : paper;
      g.fillRect(0, 0, SHEET_W, SHEET_H);
      // The same tooth every SVG sheet carries, seeded so a repaint never
      // shimmers; under the photo, because a print covers the paper.
      speckle(g, SHEET_W, SHEET_H, ink);
      if (img) {
        const s = Math.min(SHEET_W / img.width, SHEET_H / img.height);
        const iw = img.width * s;
        const ih = img.height * s;
        g.save();
        g.filter = "saturate(0.2) contrast(0.95)";
        g.globalAlpha = 0.5;
        g.drawImage(img, (SHEET_W - iw) / 2, (SHEET_H - ih) / 2, iw, ih);
        g.restore();
      }
      g.strokeStyle = sepia;
      g.lineWidth = 3.5;
      g.lineCap = g.lineJoin = "round";
      for (const s of yard.strokes) {
        if (s.k === "label") {
          g.font = "italic 26px Georgia, serif";
          g.fillStyle = sepia;
          g.fillText(s.text, s.at[0], s.at[1]);
        } else {
          const p2 = new Path2D(pathD(s.pts, s.k === "area"));
          if (s.k === "area") {
            g.save();
            // the pooled edge under the pen line, as on the plan
            g.globalAlpha = 0.1;
            g.lineWidth = 9;
            g.stroke(p2);
            g.globalAlpha = 0.13;
            g.fillStyle = sepia;
            g.fill(p2);
            g.restore();
          }
          g.stroke(p2);
        }
      }
      // her heights, the benchmarks the sheet draws, on the draped paper too
      for (const gm of yard.ground ?? []) {
        const [bx, by] = gm.at;
        g.fillStyle = sepia;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx - 9, by - 15);
        g.lineTo(bx + 9, by - 15);
        g.closePath();
        g.fill();
        g.font = "italic 22px Georgia, serif";
        g.fillText(levelLabel(gm.m), bx + 14, by - 4);
      }
      // the sheet's own border, so the card has an edge in the round
      g.strokeStyle = lineCol;
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, SHEET_W - 3, SHEET_H - 3);
      tex.needsUpdate = true;
    };
    paint(null);
    if (underlay) {
      const img = new Image();
      img.onload = () => {
        if (dead) return;
        paint(img);
        w.render();
      };
      img.src = underlay;
    }

    // The sheet drapes over the land she shaped: the plane subdivides and
    // each vertex stands at the surface's height, in the same scale the
    // figures use, so a figure's feet and the ground under them agree. An
    // unshaped yard keeps the single flat quad it always was.
    const { K, tallest } = scaleFor();
    const marks = yard.ground ?? [];
    const groundGeo = keep(
      new THREE.PlaneGeometry(
        SHEET_W,
        SHEET_H,
        marks.length ? 72 : 1,
        marks.length ? 100 : 1,
      ).rotateX(-Math.PI / 2),
    );
    if (marks.length && K > 0) {
      const pos = groundGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, groundAt(marks, pos.getX(i) + HALF_W, pos.getZ(i) + HALF_H) * K);
      }
      groundGeo.computeVertexNormals();
    }
    const ground = new THREE.Mesh(groundGeo, keep(new THREE.MeshLambertMaterial({ map: tex })));
    ground.receiveShadow = true;
    ground.castShadow = marks.length > 0; // a bank shades what stands behind it
    w.content.add(ground);

    // The sheet is a card on a table: a sunk mat under it gives the paper an
    // edge to be seen from low angles, sitting under the lowest dip.
    const board = new THREE.Mesh(
      keep(new THREE.BoxGeometry(SHEET_W + 20, 12, SHEET_H + 20)),
      keep(new THREE.MeshLambertMaterial({ color: new THREE.Color(paperSunk) })),
    );
    board.position.y = (marks.length ? groundRange(marks).min * K : 0) - 7;
    w.content.add(board);

    /* the calendar's hatch, for a bloom the record is silent on */
    const hc = document.createElement("canvas");
    hc.width = hc.height = 24;
    const hg = hc.getContext("2d")!;
    hg.fillStyle = paper;
    hg.fillRect(0, 0, 24, 24);
    hg.strokeStyle = inkFaint;
    hg.lineWidth = 3;
    hg.beginPath();
    for (let i = -24; i <= 48; i += 8) {
      hg.moveTo(i, 24);
      hg.lineTo(i + 24, 0);
    }
    hg.stroke();
    const hatch = keep(new THREE.CanvasTexture(hc));
    hatch.wrapS = hatch.wrapT = THREE.RepeatWrapping;
    hatch.repeat.set(3, 3);
    hatch.colorSpace = THREE.SRGBColorSpace;

    // The toon ramp: a few steps of the same grey, so a lit crown reads as a
    // printed illustration rather than moulded plastic. RGBA because the
    // toon shader samples all three channels; a red-only ramp tints the lot.
    const rampSteps = [96, 176, 232, 255];
    const rampData = new Uint8Array(rampSteps.length * 4);
    rampSteps.forEach((v, i) => rampData.set([v, v, v, 255], i * 4));
    const ramp = keep(new THREE.DataTexture(rampData, rampSteps.length, 1, THREE.RGBAFormat));
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;

    const bodyColor = (f: Fig) =>
      f.state === "fill" && f.fill ? f.fill : f.state === "ink" ? inkFaint : paper;
    const stateMaterial = (f: Fig) =>
      f.state === "hatch"
        ? keep(new THREE.MeshToonMaterial({ map: hatch, gradientMap: ramp }))
        : keep(new THREE.MeshToonMaterial({ color: new THREE.Color(bodyColor(f)), gradientMap: ramp }));

    // The ink line the elevation strokes around every figure, in the round:
    // a back-face shell — no post-processing, so it survives the on-demand
    // renderer. Sepia when the measurement is hers, full ink when selected.
    const outlineMats = {
      ink: keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(inkSoft), side: THREE.BackSide })),
      hers: keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(sepia), side: THREE.BackSide })),
      sel: keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(ink), side: THREE.BackSide })),
    };
    const outlineOf = (m: THREE.Mesh, mat: THREE.Material, grow: number) => {
      const o = new THREE.Mesh(m.geometry, mat);
      o.position.copy(m.position);
      o.scale.copy(m.scale).multiplyScalar(grow);
      o.castShadow = false;
      return o;
    };

    const flatRing = (rIn: number, rOut: number, color: string, y: number) => {
      const mesh = new THREE.Mesh(
        keep(new THREE.RingGeometry(rIn, rOut, 40).rotateX(-Math.PI / 2)),
        keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide })),
      );
      mesh.position.y = y;
      return mesh;
    };

    const nameSprite = (label: string) => {
      const fs = 26;
      const pad = 8;
      const c = document.createElement("canvas");
      const probe = c.getContext("2d")!;
      probe.font = `${fs}px system-ui, sans-serif`;
      const wpx = Math.ceil(probe.measureText(label).width) + pad * 2;
      const hpx = fs + pad * 2;
      c.width = wpx * 2;
      c.height = hpx * 2;
      const t = c.getContext("2d")!;
      t.scale(2, 2);
      t.font = `${fs}px system-ui, sans-serif`;
      t.fillStyle = inkSoft;
      t.textBaseline = "middle";
      t.fillText(label, pad, hpx / 2);
      const map = keep(new THREE.CanvasTexture(c));
      map.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        keep(new THREE.SpriteMaterial({ map, depthTest: false, transparent: true })),
      );
      sprite.scale.set(wpx, hpx, 1);
      return sprite;
    };

    // One archetype body, given a material. Returns the meshes and the crown's
    // top, so the caller can hang the name and reuse the same mass for a
    // shadow-only proxy behind a photo.
    const buildBody = (
      kind: ReturnType<typeof archetypeOf>,
      h: number,
      wUnits: number,
      mat: THREE.Material,
      trunkMat: THREE.Material | null,
    ): THREE.Object3D[] => {
      const parts: THREE.Object3D[] = [];
      if (kind === "tall-tree" || kind === "tree") {
        const trunkFrac = kind === "tree" ? 0.42 : 0.5;
        const crownRy = (h * (1 - trunkFrac)) / 2;
        if (trunkMat) {
          const trunk = new THREE.Mesh(keep(new THREE.CylinderGeometry(4, 6, h - crownRy)), trunkMat);
          trunk.position.y = (h - crownRy) / 2;
          trunk.castShadow = true;
          parts.push(trunk);
        }
        const crown = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 20, 14)), mat);
        crown.scale.set(wUnits / 2, crownRy, wUnits / 2);
        crown.position.y = h - crownRy;
        parts.push(crown);
      } else if (kind === "shrub" || kind === "ground") {
        const dome = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 20, 14)), mat);
        dome.scale.set(wUnits / 2, h / 2, wUnits / 2);
        dome.position.y = h / 2;
        parts.push(dome);
      } else if (kind === "herb" || kind === "root") {
        const cone = new THREE.Mesh(keep(new THREE.ConeGeometry(wUnits / 2, h, 14)), mat);
        cone.position.y = h / 2;
        parts.push(cone);
      } else {
        const col = new THREE.Mesh(keep(new THREE.CylinderGeometry(wUnits / 2, wUnits / 2, h, 14)), mat);
        col.position.y = h / 2;
        parts.push(col);
      }
      for (const p of parts) p.castShadow = true;
      return parts;
    };

    for (const f of figs) {
      const spot = new THREE.Group();
      // The figure stands on its footing — the elevation's own number, so
      // the two projections cannot disagree about where a plant's feet are.
      spot.position.set(f.x - HALF_W, f.footing * K, f.depth - HALF_H);
      spot.userData.uid = f.uid;

      let top = 0;
      if (f.height !== null && K > 0) {
        const kind = archetypeOf(f.layer);
        const grown = grownM(f, years);
        const h = Math.max(2, grown * K);
        const grownFrac = f.height > 0 ? grown / f.height : 1;
        const wUnits = Math.max(14, (f.width ?? f.height * CROWN_RATIO[kind]) * K * grownFrac);
        top = h;

        if (f.photo) {
          // Her photograph stands in the plant's place: an upright standee at
          // the plant's height, both faces showing. An invisible archetype
          // mass casts the shadow, so the shade she sees still matches the
          // crown the numbers are computed from. depthWrite is off as well as
          // colorWrite: writing depth but not colour would let this invisible
          // mass occlude the very photo it stands in front of, while shadow
          // casting comes from castShadow through the shadow pass regardless.
          const shadowMat = keep(
            new THREE.MeshLambertMaterial({ colorWrite: false, depthWrite: false }),
          );
          for (const m of buildBody(kind, h, wUnits, shadowMat, null)) {
            (m as THREE.Mesh).receiveShadow = false;
            spot.add(m);
          }
          const photoMat = keep(
            new THREE.MeshBasicMaterial({ color: new THREE.Color(paper), side: THREE.DoubleSide }),
          );
          const plane = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), photoMat);
          plane.position.y = h / 2;
          plane.scale.set(wUnits * 1.4, h, 1);
          // The print is mounted: a raised-paper border behind it, and the
          // whole stand turns to face the eye each render (see Dress) — a
          // specimen photo standing in the bed, not a floating rectangle.
          const mountMat = keep(
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(paperRaised),
              side: THREE.DoubleSide,
            }),
          );
          const mount = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), mountMat);
          mount.position.set(0, h / 2, -0.8);
          mount.scale.set(wUnits * 1.4 * 1.08, h * 1.06, 1);
          const stand = new THREE.Group();
          stand.add(mount, plane);
          spot.add(stand);
          w.dress.billboards.push({
            group: stand,
            at: new THREE.Vector3(f.x - HALF_W, 0, f.depth - HALF_H),
          });
          void getPhoto(f.photo).then((blob) => {
            if (dead || !blob) return;
            const url = URL.createObjectURL(blob);
            urls.push(url);
            const img = new Image();
            img.onload = () => {
              if (dead) return;
              const t = new THREE.Texture(img);
              t.colorSpace = THREE.SRGBColorSpace;
              t.needsUpdate = true;
              junk.push(t);
              photoMat.map = t;
              photoMat.color.set(0xffffff);
              photoMat.needsUpdate = true;
              const aspect = img.width / img.height;
              plane.scale.set(h * aspect, h, 1);
              mount.scale.set(h * aspect * 1.08, h * 1.06, 1);
              w.render();
            };
            img.src = url;
          });
        } else {
          const strokeMat = keep(
            new THREE.MeshToonMaterial({
              color: new THREE.Color(f.hers ? sepia : inkSoft),
              gradientMap: ramp,
            }),
          );
          const oMat = sel === f.uid ? outlineMats.sel : f.hers ? outlineMats.hers : outlineMats.ink;
          const grow = sel === f.uid ? 1.05 : 1.035;
          for (const m of buildBody(kind, h, wUnits, stateMaterial(f), strokeMat)) {
            spot.add(m);
            spot.add(outlineOf(m as THREE.Mesh, oMat, grow));
          }
        }

        // The years axis draws today solid and mature behind it as a ghost, so
        // the room a plant will take is the drawing, not a caption.
        if (years !== null && grown < f.height - 0.01) {
          const matureW = Math.max(14, (f.width ?? f.height * CROWN_RATIO[kind]) * K);
          const ghostMat = keep(
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(inkFaint),
              transparent: true,
              opacity: 0.12,
              depthWrite: false,
            }),
          );
          for (const m of buildBody(kind, f.height * K, matureW, ghostMat, null)) {
            (m as THREE.Mesh).castShadow = false;
            spot.add(m);
          }
        }

        if (f.hers) spot.add(flatRing(18, 21, sepia, 1.1));
      } else {
        // No height in our data: a mark on the ground, present, never a body.
        const mark = new THREE.Mesh(
          keep(new THREE.CircleGeometry(16, 28).rotateX(-Math.PI / 2)),
          f.state === "hatch"
            ? keep(new THREE.MeshBasicMaterial({ map: hatch }))
            : keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(bodyColor(f)) })),
        );
        mark.position.y = 0.8;
        spot.add(mark, flatRing(15.5, 17.5, inkSoft, 0.9));
      }

      if (f.witness) spot.add(flatRing(22, 24.5, sepia, 1.2));
      if (f.show === "match") spot.add(flatRing(27, 30.5, green, 1.0));
      if (sel === f.uid) spot.add(flatRing(33, 35.5, ink, 1.4));

      const name = nameSprite(f.label);
      name.position.y = top + 34;
      spot.add(name);
      w.dress.labels.push({
        sprite: name,
        at: new THREE.Vector3(f.x - HALF_W, f.footing * K + top + 34, f.depth - HALF_H),
        w: name.scale.x,
        h: name.scale.y,
      });

      if (f.show === "other") {
        spot.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (m) {
            m.transparent = true;
            m.opacity = 0.35;
          }
        });
      }
      w.content.add(spot);
    }

    // The measure, only when the sheet has no span of its own: a post at the
    // far corner as tall as the tallest measured thing — plant or landform —
    // saying its metres, its feet on the ground of that corner. With a span,
    // the coverage line already states the scale and the post is redundant.
    if (tallest > 0 && !yard.span) {
      const post = new THREE.Group();
      post.position.set(-HALF_W + 50, groundAt(marks, 50, 50) * K, -HALF_H + 50);
      const pole = new THREE.Mesh(
        keep(new THREE.CylinderGeometry(2.5, 2.5, tallest * K)),
        keep(new THREE.MeshLambertMaterial({ color: new THREE.Color(inkSoft) })),
      );
      pole.position.y = (tallest * K) / 2;
      post.add(pole);
      const rule = nameSprite(`${Math.round(tallest * 100) / 100} m`);
      rule.position.y = tallest * K + 26;
      post.add(rule);
      w.content.add(post);
    }

    w.render();
    return () => {
      dead = true;
      w.dress.billboards.length = 0;
      w.dress.labels.length = 0;
      w.content.clear();
      junk.forEach((d) => d.dispose());
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [figs, underlay, sel, years, yard, themeTick]);

  /* ---- the sun: her latitude cast as light, or an even day ------------- */

  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const paper = new THREE.Color(cssColor("--paper"));
    const isDark = (paper.r + paper.g + paper.b) / 3 < 0.5;
    // Dark paper eats contrast; the sun pushes a little harder there so lit
    // and shaded ground still separate.
    const boost = isDark ? 1.2 : 1;
    const setSky = (c: THREE.Color) => {
      w.scene.background = c;
      if (w.scene.fog) w.scene.fog.color.copy(c);
    };
    w.ambient.groundColor.copy(paper);
    if (!sun) {
      // No span, or she hasn't said where she is: an even, sourceless day, so
      // nothing on the ground reads as a shadow that was never computed.
      w.sunLight.castShadow = false;
      w.sunLight.color.set(0xffffff);
      w.sunLight.intensity = 0.9 * boost;
      w.sunLight.position.set(600, 1400, 400);
      w.ambient.color.set(0xffffff);
      w.ambient.intensity = 1.0;
      setSky(paper);
      w.render();
      return;
    }
    const pos = sunAt(sun.lat, sun.day, sun.hour);
    if (pos.altitude <= 0) {
      // Below the horizon: a real dusk. The page itself cools and darkens,
      // the fog follows, and no direct light is faked.
      w.sunLight.castShadow = false;
      w.sunLight.intensity = 0;
      w.ambient.color.set(0xffffff);
      w.ambient.intensity = 0.5;
      setSky(paper.clone().lerp(new THREE.Color(isDark ? 0x0e1420 : 0x565f6e), 0.45));
      w.render();
      return;
    }
    // Toward the sun, in model space: x east, z south (sheet Y), y up. north is
    // degrees clockwise from sheet-up, the same convention the sheet's rose and
    // lib/sun.ts share.
    const a = (yard.north + pos.azimuth) * RAD;
    const dx = Math.sin(a);
    const dz = -Math.cos(a);
    const dy = Math.tan(pos.altitude * RAD);
    const len = Math.hypot(dx, dy, dz) || 1;
    const D = 4000;
    w.sunLight.position.set((dx / len) * D, (dy / len) * D, (dz / len) * D);
    w.sunLight.castShadow = true;
    // Lower sun: weaker and warmer direct light under a cooler sky — the end
    // of a day, computed from her numbers exactly as the shadows are, and
    // only gently: the chrome stays paper, the warmth stays in the light.
    const alt = pos.altitude;
    w.sunLight.color.copy(
      new THREE.Color(0xf3d9ab).lerp(new THREE.Color(0xffffff), Math.min(1, alt / 28)),
    );
    w.ambient.color.copy(
      new THREE.Color(0xdfe4ec).lerp(new THREE.Color(0xffffff), Math.min(1, alt / 40)),
    );
    w.sunLight.intensity = (0.5 + 0.9 * Math.min(1, alt / 50)) * boost;
    w.ambient.intensity = 0.7 + 0.3 * Math.min(1, alt / 50);
    setSky(paper);
    w.render();
  }, [sun, yard.north, themeTick]);

  /* ---- walk in: eye level at the sheet's edge -------------------------- */

  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const { K } = scaleFor();
    if (walk) {
      const eye = yard.span ? EYE_M * K : 40;
      // Stand at the near edge (max sheet Y = +HALF_H), on the ground that
      // edge actually has, look toward the middle at eye height. Orbit still
      // works; she is just standing in her yard.
      const under = groundAt(yard.ground, SHEET_W / 2, SHEET_H) * K;
      w.camera.position.set(0, under + Math.max(eye, 12), HALF_H + 120);
      w.controls.target.set(0, under + Math.max(eye, 12), 0);
    } else {
      w.camera.position.set(650, 620, 1500);
      w.controls.target.set(0, 90, 0);
    }
    w.controls.update();
    w.render();
  }, [walk, yard.span, figs.length, yard.ground]);

  if (failed) {
    return (
      <p className="yard-coverage">
        This phone can't raise the model; the sheet and the elevation carry everything it shows.
      </p>
    );
  }
  return <div ref={host} className="yard-model" aria-label={`Model of ${yard.name}`} role="img" />;
}
