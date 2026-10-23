"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CUBE, CUBE_ENTRY_X, cubePlan, cubePoint, cubes, FLOORS, floorLevel, HALLWAYS, hallwayPath, levelName, type Cube, type CubePart } from "@/lib/building";
import { getSpot, map, spotLevel, type Spot } from "@/lib/map";
import type { Step } from "@/lib/route";

const FH = 7; // world units per floor (stretched so the tower reads as a tower)
const CUBE_H = FH * 0.84; // a cube is two short storeys
const GLOW = "#3EE6F2";
const VIOLET = "#9B7BFF";
const VOID = "#070B12";
const GREY = new THREE.Color("#3A4656");
const INTRO_MS = 2600; // circle the whole tower
const DIVE_MS = 2200; // then fly down to you

/** How far you've turned, tilted and zoomed the camera by hand. */
type Look = { yaw: number; pitch: number; zoom: number; touchedAt: number };

type Walk = { start: THREE.Vector3; end: THREE.Vector3; t0: number; dur: number; h0: number; h1: number; index: number; done: boolean };

/**
 * The whole M06 block in 3D. Opens on the full tower, dives down to where you stand,
 * then follows you along the route like a game camera. "Overview" flies back out.
 */
export default function Building3D({
  steps,
  stepIndex,
  onWalked,
}: {
  steps: Step[];
  stepIndex: number;
  onWalked: (index: number) => void;
}) {
  const [level, setLevel] = useState(() => spotLevel(getSpot(steps[stepIndex].from)!));
  const [spotId, setSpotId] = useState(steps[stepIndex].from);
  const tag = useRef<HTMLDivElement>(null);
  const [overview, setOverview] = useState(false);
  const [turned, setTurned] = useState(false);
  const look = useRef<Look>({ yaw: 0, pitch: 0, zoom: 1, touchedAt: -Infinity });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const box = useRef<HTMLDivElement>(null);

  // Scroll wheel zooms the camera instead of scrolling the page (needs a non-passive listener).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      look.current.zoom = clamp(look.current.zoom * Math.exp(e.deltaY * 0.001), 0.4, 2.5);
      look.current.touchedAt = performance.now();
      setTurned(true);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const l = look.current;
    if (pointers.current.size === 1) {
      // one finger / mouse drag: spin around and tilt
      l.yaw += (e.clientX - prev.x) * 0.008;
      l.pitch = clamp(l.pitch + (e.clientY - prev.y) * 0.005, -0.6, 0.6);
    } else {
      // two fingers: pinch to zoom
      const other = [...pointers.current].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 0) l.zoom = clamp(l.zoom * (before / after), 0.4, 2.5);
    }
    l.touchedAt = performance.now();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!turned) setTurned(true);
  }

  function placeTag(x: number, y: number, show: boolean) {
    const el = tag.current;
    if (!el) return;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    el.style.opacity = show ? "1" : "0";
  }

  function recenter() {
    look.current = { yaw: 0, pitch: 0, zoom: 1, touchedAt: -Infinity };
    setTurned(false);
  }

  return (
    <div
      ref={box}
      className="relative h-full w-full touch-none select-none"
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => pointers.current.delete(e.pointerId)}
      onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 50, near: 0.5, far: 900, position: [170, 120, 170] }}
        gl={{ antialias: true }}
        fallback={<p className="p-6 text-sm text-muted">This phone can&apos;t draw 3D. Switch to 2D.</p>}
      >
        <Scene steps={steps} stepIndex={stepIndex} onWalked={onWalked} overview={overview} onLevel={setLevel} onSpot={setSpotId} onTag={placeTag} look={look} />
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-10rem)] truncate rounded-lg border border-edge bg-panel/80 px-2.5 py-1 font-hud text-xs tracking-widest text-glow">
        {overview ? "M06 · ALL FLOORS" : `${levelName(Math.round(level))} · ${placeName(spotId)}`}
      </div>
      {/* follows your marker on screen (positioned every frame by the scene) */}
      <div ref={tag} className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-md border border-glow/60 bg-void/80 px-1.5 py-0.5 font-hud text-[9px] tracking-[0.2em] text-glow shadow-glow">
        YOU
      </div>
      {turned && (
        <button
          type="button"
          onClick={recenter}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute left-3 top-12 rounded-lg border border-edge bg-panel/80 px-2.5 py-1 font-hud text-[10px] tracking-widest text-muted"
        >
          ⟲ RECENTER
        </button>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOverview(!overview)}
        className={`absolute right-3 top-12 rounded-lg border px-2.5 py-1 font-hud text-[10px] tracking-widest ${overview ? "border-glow/60 bg-glow/20 text-glow" : "border-edge bg-panel/80 text-muted"}`}
      >
        {overview ? "DIVE IN" : "OVERVIEW"}
      </button>
    </div>
  );
}

function Scene({
  steps,
  stepIndex,
  onWalked,
  overview,
  onLevel,
  onSpot,
  onTag,
  look,
}: {
  steps: Step[];
  stepIndex: number;
  onWalked: (index: number) => void;
  overview: boolean;
  onLevel: (level: number) => void;
  onSpot: (id: string) => void;
  onTag: (x: number, y: number, show: boolean) => void;
  look: React.RefObject<Look>;
}) {
  const { camera } = useThree();
  const layers = useMemo(() => getLayers(), []);
  const top = (FLOORS.length - 2) * FH;
  const towerCenter = useMemo(() => new THREE.Vector3(0, top / 2 - 2 * FH, 0), [top]);

  const you = useRef<THREE.Group>(null);
  const youPos = useRef(toWorld(getSpot(steps[stepIndex].from)!));
  const heading = useRef(initialHeading(steps));
  const walk = useRef<Walk | null>(null);
  const shown = useRef(spotLevel(getSpot(steps[stepIndex].from)!));
  const walkedRef = useRef(onWalked);
  const levelRef = useRef(onLevel);
  const spotRef = useRef(onSpot);
  const tagRef = useRef(onTag);
  const shownSpot = useRef(steps[stepIndex].from);
  const still = useRef(false);
  const mounted = useRef(0);
  // The camera's "flying out" amount: 1 = whole tower, 0 = following you.
  const out = useRef(1);
  const lookAt = useRef(towerCenter.clone());
  const spin = useRef(0);
  const close = useRef(0);

  useEffect(() => {
    walkedRef.current = onWalked;
    levelRef.current = onLevel;
    spotRef.current = onSpot;
    tagRef.current = onTag;
  });

  useEffect(() => {
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mounted.current = performance.now();
    if (still.current) out.current = 0;
  }, []);

  // Start this step's walk from its first spot (so BACK and replays line up too).
  useEffect(() => {
    const step = steps[stepIndex];
    const a = getSpot(step.from);
    const b = getSpot(step.to);
    if (!a || !b) return;
    const start = toWorld(a);
    const end = toWorld(b);
    const flat = Math.hypot(end.x - start.x, end.z - start.z);
    const climb = Math.abs(end.y - start.y) / FH;
    const dur = still.current ? 0 : flat > 0.5 ? clamp(flat * 110, 1100, 3600) : climb > 0 ? 800 + climb * 450 : 0;
    // On first open, wait for the intro flight before walking.
    const introLeft = mounted.current ? Math.max(0, mounted.current + INTRO_MS + DIVE_MS - performance.now()) : INTRO_MS + DIVE_MS;
    walk.current = {
      start,
      end,
      t0: performance.now() + (still.current ? 0 : introLeft),
      dur,
      h0: heading.current,
      h1: flat > 0.5 ? Math.atan2(end.z - start.z, end.x - start.x) : heading.current,
      index: stepIndex,
      done: false,
    };
  }, [steps, stepIndex]);

  const route = useMemo(() => routeTubes(steps, stepIndex), [steps, stepIndex]);
  const end = useMemo(() => toWorld(getSpot(steps.at(-1)!.to)!), [steps]);
  const beacon = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const detail = useMemo(() => cubeDetail(steps), [steps]);
  const detailGroup = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    const now = performance.now();

    // walking
    const w = walk.current;
    if (w) {
      const ms = now - w.t0;
      const turn = w.dur === 0 ? 1 : ease(clamp(ms / 500, 0, 1));
      const k = w.dur === 0 ? 1 : ease(clamp((ms - 250) / w.dur, 0, 1));
      heading.current = lerpAngle(w.h0, w.h1, turn);
      youPos.current.lerpVectors(w.start, w.end, k);
      if (k >= 1 && turn >= 1 && !w.done) {
        w.done = true;
        walkedRef.current(w.index);
      }
    }
    const p = youPos.current;
    if (you.current) {
      you.current.position.copy(p);
      you.current.rotation.y = -heading.current;
    }

    // where you are: the step's start until its walk finishes, then its end
    const at = w ? (w.done ? steps[w.index].to : steps[w.index].from) : steps[stepIndex].from;
    if (at !== shownSpot.current) {
      shownSpot.current = at;
      spotRef.current(at);
    }
    const v = p.clone().add(new THREE.Vector3(0, 5, 0)).project(camera);
    tagRef.current(((v.x + 1) / 2) * state.size.width, ((1 - v.y) / 2) * state.size.height, v.z < 1);

    // which floor is lit
    const here = Math.round((p.y / FH) * 2) / 2;
    if (here !== shown.current) {
      shown.current = here;
      levelRef.current(here);
    }
    // Materials fade in the frame loop; they live outside React so this is a plain three.js update.
    for (const l of getLayers()) {
      // Your floor is the hallway level you're on plus its cubes half a flight up and down.
      const current = Math.abs(l.level - Math.floor(here)) <= 0.5;
      const wide = overview || out.current > 0.5;
      // Up close it's a cut-away: everything above your floor disappears so the camera can see in,
      // and the floors below go dark grey so only your floor reads as "here".
      const above = !wide && l.level > Math.floor(here) + 0.5;
      const fill = above ? 0 : current ? 0.5 : wide ? 0.16 : 0.025;
      const edge = above ? 0 : current ? 0.9 : wide ? 0.3 : 0.1;
      l.fill.opacity += (fill - l.fill.opacity) * 0.1;
      l.edge.opacity += (edge - l.edge.opacity) * 0.1;
      l.edge.color.lerp(current || wide ? l.color : GREY, 0.1);
    }
    if (detailGroup.current && detail) {
      detailGroup.current.visible = overview || out.current > 0.5 || detail.level <= Math.floor(here) + 0.5;
    }

    // camera: intro orbit → dive → follow; overview flies back out
    const sinceOpen = now - mounted.current;
    const intro = !still.current && sinceOpen < INTRO_MS;
    const wantOut = overview || intro ? 1 : 0;
    const diving = !still.current && !overview && sinceOpen >= INTRO_MS && sinceOpen < INTRO_MS + DIVE_MS;
    if (diving) out.current = 1 - ease((sinceOpen - INTRO_MS) / DIVE_MS);
    else out.current += (wantOut - out.current) * (1 - Math.exp(-dt * 2.5));

    const l = look.current;
    const fwd = new THREE.Vector3(Math.cos(heading.current), 0, Math.sin(heading.current));
    // Behind you by default; dragging swings the camera around you.
    // Stepping into a cube, the camera comes in close and looks down so you can read its floor plan.
    const step = steps[w?.index ?? stepIndex];
    const inCube = [step.from, step.to].some((id) => ["cube", "room"].includes(getSpot(id)?.type ?? ""));
    close.current += ((inCube ? 1 : 0) - close.current) * (1 - Math.exp(-dt * 2));
    const c = close.current;
    you.current?.scale.setScalar(1 - c * 0.55);
    const pitch = clamp(0.9 + c * 0.35 + l.pitch, 0.25, 1.45); // never past straight down
    const followPos = p.clone().add(around(heading.current + Math.PI + l.yaw, pitch, (38 - c * 18) * l.zoom));
    const followLook = p.clone().addScaledVector(fwd, l.yaw === 0 ? 10 * (1 - c) : 0);
    // The overview spins slowly on its own until you grab it.
    if (now - l.touchedAt > 3000) spin.current += dt * 0.25;
    const overPos = towerCenter.clone().add(around(spin.current + l.yaw, 0.5 + l.pitch, 200 * l.zoom));

    const o = out.current;
    const targetPos = followPos.lerp(overPos, o);
    const targetLook = followLook.lerp(towerCenter, o);
    const k = diving ? 1 : 1 - Math.exp(-dt * 4);
    camera.position.lerp(targetPos, k);
    lookAt.current.lerp(targetLook, k);
    camera.lookAt(lookAt.current);

    // destination beacon pulse
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
    ring.current?.scale.setScalar(pulse * (1 - close.current * 0.6));
    // The light beam marks the room from afar; once you're at the cube it would only block the view.
    if (beacon.current) (beacon.current.material as THREE.MeshBasicMaterial).opacity = (0.18 + Math.sin(state.clock.elapsedTime * 2) * 0.06) * (1 - close.current);
  });

  return (
    <>
      <color attach="background" args={[VOID]} />
      <fog attach="fog" args={[VOID, 90, 420]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#5fd6ff", "#0b0f1a", 0.6]} />
      <directionalLight position={[80, 160, 60]} intensity={0.8} />

      {layers.map((l) => (
        <group key={l.level}>
          <mesh geometry={l.fillGeometry} material={l.fill} />
          <lineSegments geometry={l.edgeGeometry} material={l.edge} />
        </group>
      ))}

      <LiftShafts top={top} />

      {/* route: walked, now, ahead */}
      {route.done && <Tube tube={route.done} color={VIOLET} opacity={0.6} />}
      {route.ahead && <Tube tube={route.ahead} color={GLOW} opacity={0.75} />}
      {route.now && <Tube tube={route.now} color={GLOW} opacity={1} wide />}

      {/* the cube on your route, with its rooms, toilet and stairs */}
      {detail && (
        <group ref={detailGroup}>
          {detail.parts.slabs && <Part geo={detail.parts.slabs} fill="#0E2030" fillOpacity={0.6} edge={GLOW} edgeOpacity={0.35} />}
          {detail.parts.rooms && <Part geo={detail.parts.rooms} fill="#0F3A44" fillOpacity={0.35} edge="#46D9E6" edgeOpacity={0.85} />}
          {detail.parts.toilet && <Part geo={detail.parts.toilet} fill="#26313D" fillOpacity={0.5} edge="#8FA1AD" edgeOpacity={0.7} />}
          {detail.parts.stairs && <Part geo={detail.parts.stairs} fill={VIOLET} fillOpacity={0.35} edge={VIOLET} edgeOpacity={0.95} />}
          {detail.parts.upper && <Part geo={detail.parts.upper} fill="#1A2633" fillOpacity={0.08} edge="#3A4656" edgeOpacity={0.35} />}
          {detail.parts.target && <Part geo={detail.parts.target} fill={GLOW} fillOpacity={0.4} edge={GLOW} edgeOpacity={1} />}
        </group>
      )}

      {/* destination */}
      <mesh ref={beacon} position={[end.x, end.y + 30, end.z]}>
        <cylinderGeometry args={[1.4, 1.4, 60, 16, 1, true]} />
        <meshBasicMaterial color={GLOW} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring} position={[end.x, end.y + 0.6, end.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.2, 0.25, 8, 40]} />
        <meshBasicMaterial color={GLOW} toneMapped={false} />
      </mesh>

      {/* you */}
      <group ref={you}>
        <mesh position={[0, 1.6, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[1.3, 3.6, 4]} />
          <meshBasicMaterial color={GLOW} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.2, 2.8, 32]} />
          <meshBasicMaterial color={GLOW} transparent opacity={0.6} depthWrite={false} />
        </mesh>
        <pointLight color={GLOW} intensity={60} distance={30} position={[0, 4, 0]} />
      </group>
    </>
  );
}

function Tube({ tube, color, opacity, wide }: { tube: RouteTube; color: string; opacity: number; wide?: boolean }) {
  return (
    <group>
      <mesh geometry={tube.core}>
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
      </mesh>
      {/* soft glow shell */}
      <mesh geometry={tube.glow}>
        <meshBasicMaterial color={color} transparent opacity={wide ? 0.3 : 0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function Part({
  geo,
  fill,
  fillOpacity,
  edge,
  edgeOpacity,
}: {
  geo: { fill: THREE.BufferGeometry; edge: THREE.BufferGeometry };
  fill: string;
  fillOpacity: number;
  edge: string;
  edgeOpacity: number;
}) {
  return (
    <group>
      <mesh geometry={geo.fill}>
        <meshBasicMaterial color={fill} transparent opacity={fillOpacity} depthWrite={false} />
      </mesh>
      <lineSegments geometry={geo.edge}>
        <lineBasicMaterial color={edge} transparent opacity={edgeOpacity} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

function LiftShafts({ top }: { top: number }) {
  const bottom = floorLevel("B2") * FH;
  const height = top + FH - bottom;
  return (
    <group>
      {[-4, -1.3, 1.3, 4].flatMap((x) =>
        [-4.3, 4.3].map((z) => (
          <mesh key={`${x}${z}`} position={[x, bottom + height / 2, z]}>
            <boxGeometry args={[2, height, 2]} />
            <meshBasicMaterial color={GLOW} transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        )),
      )}
    </group>
  );
}

// ---- geometry ----

type Box = { center: [number, number, number]; size: [number, number, number]; angle?: number };

type Layer = {
  level: number;
  fillGeometry: THREE.BufferGeometry;
  edgeGeometry: THREE.BufferGeometry;
  fill: THREE.MeshStandardMaterial;
  edge: THREE.LineBasicMaterial;
  /** Outline colour when lit; it fades to grey when it's not your floor. */
  color: THREE.Color;
};

let built: Layer[] | null = null;
function getLayers(): Layer[] {
  built ??= buildLayers();
  return built;
}

/** Every floor and every half level of cubes as one merged mesh + outline each, so the whole block is ~50 draw calls. */
function buildLayers(): Layer[] {
  const boxes = new Map<number, Box[]>();
  const add = (level: number, box: Box) => boxes.set(level, [...(boxes.get(level) ?? []), box]);
  const allCubes = cubes();

  for (const floor of FLOORS) {
    const level = floorLevel(floor);
    const y = level * FH;
    add(level, { center: [0, y - 0.25, 0], size: [16, 0.5, 16] });
    for (const h of HALLWAYS) {
      const path = hallwayPath(h);
      for (let i = 1; i < path.length; i++) add(level, segment(path[i - 1], path[i], y, 5));
      const [ex, ey] = path.at(-1)!;
      // staircase at the hallway's end: up one flight, landing, back up the other side to the next floor
      const len = Math.hypot(ex, ey);
      const [ux, uy] = [ex / len, ey / len];
      const at = (along: number, side: number): [number, number] => [ex + ux * along - uy * side, ey + uy * along + ux * side];
      for (const b of flight(at(0.5, -1.1), at(4.5, -1.1), y, FH / 2, 1.8)) add(level, b);
      add(level, { center: [...withY(at(5.4, 0), y + FH / 2 - 0.15)], size: [1.8, 0.3, 4.4], angle: Math.atan2(uy, ux) });
      for (const b of flight(at(4.5, 1.1), at(0.5, 1.1), y + FH / 2, FH / 2, 1.8)) add(level, b);
    }
  }

  for (const floor of FLOORS) {
    const level = floorLevel(floor);
    for (const c of allCubes) {
      const base = (level + c.half) * FH;
      const angle = (c.angle * Math.PI) / 180;
      add(level + c.half, { center: [c.center[0], base + CUBE_H / 2, c.center[1]], size: [CUBE.width, CUBE_H, CUBE.depth], angle });
      // half a flight from the hallway's edge up (or down) to the cube's entry gap
      const to = cubePoint(c, CUBE_ENTRY_X, 0);
      const from: [number, number] = [c.door[0] + c.inward[0] * 2.5, c.door[1] + c.inward[1] * 2.5];
      for (const b of flight(from, to, level * FH, c.half * FH, 1.4)) add(level + c.half, b);
    }
  }

  // Car parks, entrances and outside paths from the map, on their own floors.
  for (const s of map.spots) {
    if (s.type === "parking") add(spotLevel(s), { center: [s.pos[0], spotLevel(s) * FH - 0.2, s.pos[1]], size: [20, 0.4, 16] });
  }
  for (const l of map.links) {
    const [a, b] = [getSpot(l.from)!, getSpot(l.to)!];
    if (l.from < l.to && spotLevel(a) === spotLevel(b) && (a.type === "parking" || a.type === "entrance" || b.type === "parking" || b.type === "entrance")) {
      add(spotLevel(a), segment(a.pos, b.pos, spotLevel(a) * FH, 4));
    }
  }

  return [...boxes].map(([level, list]) => {
    const merged = mergeBoxes(list);
    const isFloor = Number.isInteger(level);
    // Calm steel for the structure; only the route and the cube you're heading to glow.
    const lit = isFloor ? "#5E7FA3" : "#6F78B8";
    return {
      level,
      fillGeometry: merged.fill,
      edgeGeometry: merged.edge,
      fill: new THREE.MeshStandardMaterial({
        color: isFloor ? "#13283d" : "#182c45",
        emissive: isFloor ? "#06202c" : "#0d1838",
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
      edge: new THREE.LineBasicMaterial({ color: lit, transparent: true, opacity: 0.2 }),
      color: new THREE.Color(lit),
    };
  });
}

function mergeBoxes(list: Box[]): { fill: THREE.BufferGeometry; edge: THREE.BufferGeometry } {
  const fills: THREE.BufferGeometry[] = [];
  const edges: THREE.BufferGeometry[] = [];
  for (const b of list) {
    const geo = new THREE.BoxGeometry(...b.size);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...b.center),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -(b.angle ?? 0)),
      new THREE.Vector3(1, 1, 1),
    );
    edges.push(new THREE.EdgesGeometry(geo).applyMatrix4(m));
    fills.push(geo.applyMatrix4(m));
  }
  return { fill: mergeGeometries(fills)!, edge: mergeGeometries(edges)! };
}

type CubeDetail = {
  level: number;
  parts: Record<"slabs" | "rooms" | "target" | "toilet" | "stairs" | "upper", { fill: THREE.BufferGeometry; edge: THREE.BufferGeometry } | null>;
};

/**
 * The cube your route goes into, drawn from the learner's plan: two floors, each with
 * rooms 1–4, the toilet and the stairs (swapped on floor 2), and your room picked out.
 */
function cubeDetail(steps: Step[]): CubeDetail | null {
  const ids = steps.flatMap((s) => [s.from, s.to]);
  const spot = ids.map((id) => getSpot(id)!).find((s) => s.type === "cube");
  if (!spot) return null;
  const room = ids.map((id) => getSpot(id)!).find((s) => s.type === "room");

  // The cube spot sits just inside its entry gap; that tells the two mirrored cubes of a stack apart.
  const near = (c: Cube) => {
    const [ex, ey] = cubePoint(c, CUBE_ENTRY_X, 0.6);
    return Math.hypot(ex - spot.pos[0], ey - spot.pos[1]);
  };
  const cube = cubes().reduce((a, b) => (near(b) < near(a) ? b : a));
  // Your room is whichever room on the plan its map position falls closest to.
  const roomCenter = (p: CubePart) => cubePoint(cube, (p.x[0] + p.x[1]) / 2, (p.d[0] + p.d[1]) / 2);
  const dist = (p: CubePart) => (room ? Math.hypot(roomCenter(p)[0] - room.pos[0], roomCenter(p)[1] - room.pos[1]) : Infinity);
  const target = room ? cubePlan(1).filter((p) => p.kind === "room").reduce((a, b) => (dist(b) < dist(a) ? b : a)).room : null;
  const level = spotLevel(spot);
  const angle = (cube.angle * Math.PI) / 180;
  const storey = CUBE_H / 2;

  const groups: Record<keyof CubeDetail["parts"], Box[]> = { slabs: [], rooms: [], target: [], toilet: [], stairs: [], upper: [] };
  const area = (x: [number, number], d: [number, number], y: number, h: number): Box => {
    const [cx, cz] = cubePoint(cube, (x[0] + x[1]) / 2, (d[0] + d[1]) / 2);
    return { center: [cx, y + h / 2, cz], size: [x[1] - x[0], h, d[1] - d[0]], angle };
  };
  for (const floor of [1, 2] as const) {
    const y = level * FH + (floor - 1) * storey;
    // Floor 2 is drawn faintly as one piece so the floor you walk in on reads clearly from above.
    const into = (key: keyof CubeDetail["parts"]) => (floor === 1 ? groups[key] : groups.upper);
    into("slabs").push(area([-CUBE.width / 2, CUBE.width / 2], [0, CUBE.depth], y - 0.15, 0.15));
    for (const part of cubePlan(floor)) {
      if (part.kind === "stairs") {
        // floor 1: up toward the hallway side; floor 2: the top of the same flight
        const mid = (part.x[0] + part.x[1]) / 2;
        const [a, b] = [cubePoint(cube, mid, part.d[1]), cubePoint(cube, mid, part.d[0])];
        const flightBoxes = floor === 1 ? flight(a, b, y, storey / 2, part.x[1] - part.x[0], 6) : flight(b, a, y, -storey / 2, part.x[1] - part.x[0], 6);
        into("stairs").push(...flightBoxes);
      } else {
        const walls = area(part.x, part.d, y, storey * 0.8);
        if (part.kind === "room" && part.room === target && floor === 1) groups.target.push(walls);
        else into(part.kind === "room" ? "rooms" : "toilet").push(walls);
      }
    }
  }
  const parts = Object.fromEntries(
    Object.entries(groups).map(([k, list]) => [k, list.length ? mergeBoxes(list) : null]),
  ) as CubeDetail["parts"];
  return { level, parts };
}

/** A flight of stairs from `a` to `b` (map points), starting at height y0 and climbing `rise` (negative goes down). */
function flight(a: [number, number], b: [number, number], y0: number, rise: number, width: number, n = 7): Box[] {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const run = Math.hypot(b[0] - a[0], b[1] - a[1]) / n;
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const top = y0 + (rise * (i + 1)) / n;
    return { center: [a[0] + (b[0] - a[0]) * t, top - 0.15, a[1] + (b[1] - a[1]) * t], size: [run, 0.3, width], angle };
  });
}

function withY([x, z]: [number, number], y: number): [number, number, number] {
  return [x, y, z];
}

/** A flat walkway between two map points, `width` wide, lying at height y. */
function segment(a: [number, number], b: [number, number], y: number, width: number): Box {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    center: [(a[0] + b[0]) / 2, y - 0.2, (a[1] + b[1]) / 2],
    size: [len + width * 0.6, 0.4, width],
    angle: Math.atan2(b[1] - a[1], b[0] - a[0]),
  };
}

type RouteTube = { core: THREE.BufferGeometry; glow: THREE.BufferGeometry };

function routeTubes(steps: Step[], stepIndex: number) {
  const tube = (list: Step[]): RouteTube | null => {
    const curve = new THREE.CurvePath<THREE.Vector3>();
    for (const s of list) {
      const [a, b] = [toWorld(getSpot(s.from)!), toWorld(getSpot(s.to)!)];
      if (a.distanceTo(b) > 0.01) curve.add(new THREE.LineCurve3(a.setY(a.y + 0.9), b.setY(b.y + 0.9)));
    }
    if (curve.curves.length === 0) return null;
    const segments = curve.curves.length * 24;
    return { core: new THREE.TubeGeometry(curve, segments, 0.45, 8, false), glow: new THREE.TubeGeometry(curve, segments, 1.5, 10, false) };
  };
  return {
    done: tube(steps.slice(0, stepIndex)),
    now: tube([steps[stepIndex]]),
    ahead: tube(steps.slice(stepIndex + 1)),
  };
}

/** "SE Hallway · Stair 2 (up)" → "SE HALLWAY · STAIR 2"; the floor is shown separately. */
function placeName(id: string): string {
  const label = getSpot(id)?.label ?? "";
  return label
    .replace(/s*((up|down))/, "")
    .replace(/^(Floor d+|Bd) · /, "")
    .replace(/ · (Floor d+|Bd)$/, "")
    .toUpperCase();
}

/** A point on a sphere: `angle` around (map heading), `pitch` up from level, `dist` away. */
function around(angle: number, pitch: number, dist: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(angle) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.sin(angle) * Math.cos(pitch) * dist);
}

function toWorld(spot: Spot): THREE.Vector3 {
  return new THREE.Vector3(spot.pos[0], spotLevel(spot) * FH, spot.pos[1]);
}

function initialHeading(steps: Step[]): number {
  for (const step of steps) {
    const a = getSpot(step.from);
    const b = getSpot(step.to);
    if (a && b && (a.pos[0] !== b.pos[0] || a.pos[1] !== b.pos[1])) {
      return Math.atan2(b.pos[1] - a.pos[1], b.pos[0] - a.pos[0]);
    }
  }
  return -Math.PI / 2;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
function lerpAngle(a: number, b: number, t: number) {
  const d = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}
