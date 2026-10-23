"use client";

import {
  AdaptiveDpr,
  ContactShadows,
  Environment,
  Grid,
  Html,
  Lightformer,
  OrbitControls,
  PerformanceMonitor,
  useProgress,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Robot, type RobotProps } from "./Robot";
import { type ViewPreset, useRobot } from "./RobotContext";

const PRESETS: Record<ViewPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  iso: { pos: [2.1, 1.25, 2.0], target: [0.05, 0.45, 0] },
  front: { pos: [2.8, 0.75, 0.0], target: [0.1, 0.45, 0] },
  side: { pos: [0.1, 0.65, 2.9], target: [0.05, 0.42, 0] },
  rear: { pos: [-2.4, 1.1, -1.4], target: [0, 0.45, 0] },
  top: { pos: [0.05, 3.3, 0.01], target: [0.05, 0.4, 0] },
  detail: { pos: [0.9, 0.55, 0.85], target: [0.4, 0.38, 0.2] },
};

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="w-56 rounded border border-line-2 bg-panel/90 px-4 py-3 text-center backdrop-blur">
        <p className="label mb-2">Loading ARGO-Q4 asset</p>
        <div className="h-1 w-full overflow-hidden rounded bg-line-2">
          <div className="h-full bg-signal transition-[width]" style={{ width: `${progress.toFixed(0)}%` }} />
        </div>
        <p className="mt-2 font-mono text-xs text-soft">{progress.toFixed(0)} %</p>
      </div>
    </Html>
  );
}

/** Camera presets, part focus and walk-following. */
function CameraRig() {
  const { camera, ctrl, follow } = useRobot();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const cam = useThree((s) => s.camera);
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number } | null>(null);
  const lastRoot = useRef(new THREE.Vector3());
  const rootPos = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!camera || !controls) return;
    let to: THREE.Vector3, tTo: THREE.Vector3;
    if (camera.kind === "focus" && camera.part && ctrl) {
      tTo = ctrl.partCenter(camera.part);
      const size = Math.max(ctrl.partSize(camera.part), 0.18);
      const dir = cam.position.clone().sub(controls.target).normalize();
      to = tTo.clone().add(dir.multiplyScalar(size * 2.6 + 0.25));
    } else {
      const p = PRESETS[camera.preset ?? "iso"];
      const off = ctrl?.scene.getObjectByName("ARGO_Q4")?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
      to = new THREE.Vector3(...p.pos).add(off);
      tTo = new THREE.Vector3(...p.target).add(off);
    }
    anim.current = { from: cam.position.clone(), to, tFrom: controls.target.clone(), tTo, t: 0 };
  }, [camera, controls, ctrl, cam]);

  useFrame((_, dt) => {
    if (!controls) return;
    const a = anim.current;
    if (a) {
      a.t = Math.min(a.t + dt / 0.9, 1);
      const k = 1 - Math.pow(1 - a.t, 3);
      cam.position.lerpVectors(a.from, a.to, k);
      controls.target.lerpVectors(a.tFrom, a.tTo, k);
      if (a.t >= 1) anim.current = null;
    }
    // follow the robot while it walks: translate camera + target by the root delta
    const root = ctrl?.scene.getObjectByName("ARGO_Q4");
    if (root) {
      root.getWorldPosition(rootPos.current);
      const d = rootPos.current.clone().sub(lastRoot.current);
      if (follow && !a && d.lengthSq() > 0 && d.lengthSq() < 1) {
        cam.position.add(d);
        controls.target.add(d);
      }
      lastRoot.current.copy(rootPos.current);
    }
    controls.update();
  });
  return null;
}

function Lights({ quality }: { quality: number }) {
  return (
    <>
      <hemisphereLight args={["#b9c6d6", "#0b0d10", 0.45]} />
      <directionalLight
        position={[3.2, 5, 2.4]}
        intensity={2.4}
        castShadow={quality > 0}
        shadow-mapSize={[quality > 1 ? 2048 : 1024, quality > 1 ? 2048 : 1024]}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-2.5}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-4, 2.2, -3]} intensity={1.3} color="#9ccfff" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[7, 7, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#ffd9c2" position={[4, 1.5, 2]} rotation-y={-Math.PI / 3} scale={[3, 1.4, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#bfe6ff" position={[-4, 1.2, -1]} rotation-y={Math.PI / 2.4} scale={[3, 1.2, 1]} />
        <Lightformer form="ring" intensity={0.9} position={[0, 1, -5]} scale={3} />
      </Environment>
    </>
  );
}

export interface SceneProps extends RobotProps {
  className?: string;
  controls?: boolean;
  grid?: boolean;
  initialView?: ViewPreset;
  minDistance?: number;
  maxDistance?: number;
  quality?: number; // 0 low, 1 medium, 2 high
  showStats?: (s: { fps: number; calls: number; tris: number }) => void;
}

function StatsProbe({ cb }: { cb: NonNullable<SceneProps["showStats"]> }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    acc.current.t += dt;
    acc.current.n += 1;
    if (acc.current.t > 0.5) {
      cb({ fps: acc.current.n / acc.current.t, calls: gl.info.render.calls, tris: gl.info.render.triangles });
      acc.current = { t: 0, n: 0 };
    }
  });
  return null;
}

export default function Scene({
  className,
  controls = true,
  grid = true,
  initialView = "iso",
  minDistance = 0.45,
  maxDistance = 7,
  quality: q0 = 2,
  showStats,
  ...robot
}: SceneProps) {
  const { autoRotate } = useRobot();
  const [quality, setQuality] = useState(q0);
  // narrow / portrait screens need the camera further back to fit the robot
  const p = useMemo(() => {
    const base = PRESETS[initialView];
    const narrow = typeof window !== "undefined" && window.innerWidth / Math.max(window.innerHeight, 1) < 0.9;
    if (!narrow) return base;
    const k = 1.85;
    const pos = base.pos.map((v, i) => base.target[i] + (v - base.target[i]) * k) as [number, number, number];
    return { pos, target: base.target };
  }, [initialView]);
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, quality > 1 ? 2 : 1.5]}
        camera={{ position: p.pos, fov: 38, near: 0.02, far: 60 }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={["#07090c"]} />
        <fog attach="fog" args={["#07090c", 7, 18]} />
        <PerformanceMonitor onDecline={() => setQuality((v) => Math.max(0, v - 1))} />
        <AdaptiveDpr pixelated={false} />
        <Lights quality={quality} />
        <Suspense fallback={<Loader />}>
          <Robot {...robot} />
        </Suspense>
        <ContactShadows position={[0, 0.002, 0]} opacity={0.55} scale={8} blur={2.4} far={1.6} resolution={quality > 1 ? 1024 : 512} color="#000000" />
        {grid && (
          <Grid
            infiniteGrid
            cellSize={0.1}
            sectionSize={0.5}
            cellThickness={0.6}
            sectionThickness={1.1}
            cellColor="#151b22"
            sectionColor="#26313d"
            fadeDistance={11}
            fadeStrength={1.6}
            position={[0, 0.0005, 0]}
          />
        )}
        {controls && (
          <OrbitControls
            makeDefault
            target={p.target}
            enableDamping
            dampingFactor={0.08}
            minDistance={minDistance}
            maxDistance={maxDistance}
            maxPolarAngle={Math.PI / 2 - 0.03}
            autoRotate={autoRotate}
            autoRotateSpeed={0.6}
          />
        )}
        {controls && <CameraRig />}
        {showStats && <StatsProbe cb={showStats} />}
      </Canvas>
    </div>
  );
}
