import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { archetypeOf, CROWN_RATIO } from "@/lib/elevation";
import { getPhoto } from "@/lib/photos";
import { sunAt } from "@/lib/sun";
import { pathD, SHEET_H, SHEET_W, type Yard } from "@/lib/yards";
import { grownM, type Fig } from "./ElevationView";

/**
 * The model: the sheet laid flat and the record standing on it, in the round.
 *
 * Every rule the elevation keeps holds here, because the third projection is
 * not a third vocabulary. The ground IS her sheet: the same paper, her ink
 * and her washed photo drawn onto its texture. A plant with no height in our
 * data is a flat mark on the ground, never a body; figures are the layer's
 * archetype at the record's height, in her ink when the measurement is hers;
 * bloom colour is the only saturated thing in the scene.
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

type World = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  sunLight: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
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
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const scaleFor = () => {
    const measured = figs.filter((f) => f.height !== null);
    const maxM = measured.length ? Math.max(...measured.map((f) => f.height!)) : 0;
    const K = yard.span ? 1000 / yard.span : maxM > 0 ? TOP_UNITS / maxM : 0;
    return { K, maxM };
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
    const render = () => renderer.render(scene, camera);
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

    world.current = { renderer, scene, camera, controls, content, sunLight, ambient, render };
    return () => {
      ro.disconnect();
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
    const ink = cssColor("--ink");
    const inkSoft = cssColor("--ink-soft");
    const inkFaint = cssColor("--ink-faint");
    const sepia = cssColor("--sepia");
    const green = cssColor("--green");

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
      g.fillStyle = paper;
      g.fillRect(0, 0, SHEET_W, SHEET_H);
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
            g.globalAlpha = 0.13;
            g.fillStyle = sepia;
            g.fill(p2);
            g.restore();
          }
          g.stroke(p2);
        }
      }
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

    const ground = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(SHEET_W, SHEET_H).rotateX(-Math.PI / 2)),
      keep(new THREE.MeshLambertMaterial({ map: tex })),
    );
    ground.receiveShadow = true;
    w.content.add(ground);

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

    const bodyColor = (f: Fig) =>
      f.state === "fill" && f.fill ? f.fill : f.state === "ink" ? inkFaint : paper;
    const stateMaterial = (f: Fig) =>
      f.state === "hatch"
        ? keep(new THREE.MeshLambertMaterial({ map: hatch }))
        : keep(new THREE.MeshLambertMaterial({ color: new THREE.Color(bodyColor(f)) }));

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

    const { K, maxM } = scaleFor();

    for (const f of figs) {
      const spot = new THREE.Group();
      spot.position.set(f.x - HALF_W, 0, f.depth - HALF_H);
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
          // crown the numbers are computed from.
          const shadowMat = keep(
            new THREE.MeshLambertMaterial({ colorWrite: false }),
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
          spot.add(plane);
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
              w.render();
            };
            img.src = url;
          });
        } else {
          const strokeMat = keep(
            new THREE.MeshLambertMaterial({ color: new THREE.Color(f.hers ? sepia : inkSoft) }),
          );
          for (const m of buildBody(kind, h, wUnits, stateMaterial(f), strokeMat)) spot.add(m);
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
    // far corner as tall as the tallest plant, saying its metres. With a span,
    // the coverage line already states the scale and the post is redundant.
    if (maxM > 0 && !yard.span) {
      const post = new THREE.Group();
      post.position.set(-HALF_W + 50, 0, -HALF_H + 50);
      const pole = new THREE.Mesh(
        keep(new THREE.CylinderGeometry(2.5, 2.5, maxM * K)),
        keep(new THREE.MeshLambertMaterial({ color: new THREE.Color(inkSoft) })),
      );
      pole.position.y = (maxM * K) / 2;
      post.add(pole);
      const rule = nameSprite(`${Math.round(maxM * 100) / 100} m`);
      rule.position.y = maxM * K + 26;
      post.add(rule);
      w.content.add(post);
    }

    w.render();
    return () => {
      dead = true;
      w.content.clear();
      junk.forEach((d) => d.dispose());
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [figs, underlay, sel, years, yard]);

  /* ---- the sun: her latitude cast as light, or an even day ------------- */

  useEffect(() => {
    const w = world.current;
    if (!w) return;
    if (!sun) {
      // No span, or she hasn't said where she is: an even, sourceless day, so
      // nothing on the ground reads as a shadow that was never computed.
      w.sunLight.castShadow = false;
      w.sunLight.intensity = 0.9;
      w.sunLight.position.set(600, 1400, 400);
      w.ambient.intensity = 1.0;
      w.render();
      return;
    }
    const pos = sunAt(sun.lat, sun.day, sun.hour);
    if (pos.altitude <= 0) {
      // Below the horizon: dusk. No direct light, a low ambient; the bed lines
      // already say the hour is dark.
      w.sunLight.castShadow = false;
      w.sunLight.intensity = 0;
      w.ambient.intensity = 0.5;
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
    // Lower sun, weaker direct light and a warmer floor, like the end of a day.
    const alt = pos.altitude;
    w.sunLight.intensity = 0.5 + 0.9 * Math.min(1, alt / 50);
    w.ambient.intensity = 0.7 + 0.3 * Math.min(1, alt / 50);
    w.render();
  }, [sun, yard.north]);

  /* ---- walk in: eye level at the sheet's edge -------------------------- */

  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const { K } = scaleFor();
    if (walk) {
      const eye = yard.span ? EYE_M * K : 40;
      // Stand at the near edge (max sheet Y = +HALF_H), look toward the middle
      // at eye height. Orbit still works; she is just standing in the yard.
      w.camera.position.set(0, Math.max(eye, 12), HALF_H + 120);
      w.controls.target.set(0, Math.max(eye, 12), 0);
    } else {
      w.camera.position.set(650, 620, 1500);
      w.controls.target.set(0, 90, 0);
    }
    w.controls.update();
    w.render();
  }, [walk, yard.span, figs.length]);

  if (failed) {
    return (
      <p className="yard-coverage">
        This phone can't raise the model; the sheet and the elevation carry everything it shows.
      </p>
    );
  }
  return <div ref={host} className="yard-model" aria-label={`Model of ${yard.name}`} role="img" />;
}
