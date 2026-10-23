"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { KIND_COLOR } from "@/components/OutlineEditor";
import type { Floor } from "@/lib/buildings";
import { KIND_HEIGHT, toMetres } from "@/lib/outline";

const FLOOR_H = 4; // metres between floors
const GUESS_WIDTH = 60; // metres across a plan that has no scale yet

/** Every floor stacked, with its outlines raised into 3D over its plan image. Drag to spin, pinch to zoom. */
export default function BuildingModel3D({ floors }: { floors: Floor[] }) {
  const span = Math.max(20, ...floors.map((f) => Math.max(f.width, f.height) * mppOf(f)));
  const top = floors.length * FLOOR_H;
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 0.5, far: 4000, position: [span * 0.55, top + span * 0.45, span * 0.55] }}>
      <color attach="background" args={["#070B12"]} />
      <fog attach="fog" args={["#070B12", span * 2, span * 5]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[span, span * 2, span * 0.5]} intensity={0.9} />
      <Controls height={top / 2} />
      {floors.map((f, i) => (
        <FloorModel key={f.id} floor={f} y={i * FLOOR_H} />
      ))}
    </Canvas>
  );
}

function mppOf(f: Floor): number {
  return f.metresPerPixel ?? GUESS_WIDTH / f.width;
}

function FloorModel({ floor, y }: { floor: Floor; y: number }) {
  const mpp = mppOf(floor);
  const texture = useMemo(() => {
    const t = new THREE.TextureLoader().load(floor.image);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [floor.image]);

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
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: KIND_HEIGHT[o.kind] * FLOOR_H, bevelEnabled: false });
        geometry.rotateX(-Math.PI / 2);
        return { kind: o.kind, geometry, edges: new THREE.EdgesGeometry(geometry) };
      }),
    [floor, mpp],
  );

  return (
    <group position={[0, y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[floor.width * mpp, floor.height * mpp]} />
        <meshBasicMaterial map={texture} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {shapes.map((s, i) => (
        <group key={i}>
          <mesh geometry={s.geometry}>
            <meshStandardMaterial color={KIND_COLOR[s.kind]} transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <lineSegments geometry={s.edges}>
            <lineBasicMaterial color={KIND_COLOR[s.kind]} />
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
