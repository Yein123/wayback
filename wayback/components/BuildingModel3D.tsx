"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { KIND_COLOR } from "@/components/OutlineEditor";
import type { Floor } from "@/lib/buildings";
import { KIND_HEIGHT, toMetres } from "@/lib/outline";

const GUESS_WIDTH = 100; // metres across a plan that has no scale yet

/**
 * Every floor stacked, with its outlines raised into 3D over its plan image. Drag to spin, pinch to zoom.
 * Floors are spread further apart than real life (like the M06 view), or a wide mall would look like one layer.
 * The buttons focus one floor and fade the rest.
 */
export default function BuildingModel3D({
  floors,
  focus,
  onFocus,
}: {
  floors: Floor[];
  /** The floor index in focus, or null for all floors. */
  focus: number | null;
  onFocus: (index: number | null) => void;
}) {
  const span = Math.max(20, ...floors.map((f) => Math.max(f.width, f.height) * mppOf(f)));
  const gap = Math.max(4, span * 0.12); // height between floors in the view
  const top = (floors.length - 1) * gap;

  return (
    <div className="relative h-full w-full">
      <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 0.5, far: 6000, position: [span * 0.85, top * 0.7 + span * 0.3, span * 0.85] }}>
        <color attach="background" args={["#070B12"]} />
        <fog attach="fog" args={["#070B12", span * 2.5, span * 6]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[span, span * 2, span * 0.5]} intensity={0.9} />
        <Controls height={focus === null ? top / 2 : focus * gap} />
        {floors.map((f, i) => (
          <FloorModel key={f.id} floor={f} y={i * gap} gap={gap} look={focus === null ? "all" : focus === i ? "focus" : "dim"} />
        ))}
      </Canvas>
      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 font-hud text-[10px] tracking-widest">
        {[null, ...floors.map((_, i) => i)].map((i) => (
          <button
            key={i ?? "all"}
            type="button"
            onClick={() => onFocus(i)}
            className={`rounded-lg border px-2 py-1 ${focus === i ? "border-glow bg-glow/20 text-glow" : "border-edge bg-panel/80 text-muted"}`}
          >
            {i === null ? "ALL" : floors[i].label.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function mppOf(f: Floor): number {
  return f.metresPerPixel ?? GUESS_WIDTH / f.width;
}

function FloorModel({ floor, y, gap, look }: { floor: Floor; y: number; gap: number; look: "all" | "focus" | "dim" }) {
  // All floors: see-through so the lower ones show between; one floor focused: solid, the rest faint.
  const dim = look === "dim";
  const planOpacity = look === "focus" ? 0.95 : look === "all" ? 0.55 : 0.06;
  const mpp = mppOf(floor);
  const [w, h] = [floor.width * mpp, floor.height * mpp];
  const texture = useMemo(() => {
    const t = new THREE.TextureLoader().load(floor.image);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [floor.image]);

  const frame = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2)), [w, h]);

  const shapes = useMemo(
    () =>
      floor.outlines.map((o) => {
        const shape = new THREE.Shape();
        o.points.forEach((p, i) => {
          // Plan "down" is world +z; the shape is laid flat by turning it about x below, which flips y.
          const [x, z] = toMetres(p, floor, mpp);
          if (i === 0) shape.moveTo(x, -z);
          else shape.lineTo(x, -z);
        });
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: KIND_HEIGHT[o.kind] * gap * 0.8, bevelEnabled: false });
        geometry.rotateX(-Math.PI / 2);
        return { kind: o.kind, geometry, edges: new THREE.EdgesGeometry(geometry) };
      }),
    [floor, mpp, gap],
  );

  return (
    <group position={[0, y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} transparent opacity={planOpacity} depthWrite={look === "focus"} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={frame}>
        <lineBasicMaterial color={dim ? "#3A4656" : "#3EE6F2"} transparent opacity={dim ? 0.3 : 0.9} />
      </lineSegments>
      {shapes.map((s, i) => (
        <group key={i}>
          <mesh geometry={s.geometry}>
            <meshStandardMaterial color={KIND_COLOR[s.kind]} transparent opacity={dim ? 0.06 : 0.55} depthWrite={false} />
          </mesh>
          <lineSegments geometry={s.edges}>
            <lineBasicMaterial color={dim ? "#3A4656" : KIND_COLOR[s.kind]} transparent opacity={dim ? 0.3 : 1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

function Controls({ height }: { height: number }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, height, 0);
    controls.enableDamping = true;
    let frame = 0;
    const tick = () => {
      controls.update();
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      controls.dispose();
    };
  }, [camera, gl, height]);
  return null;
}
