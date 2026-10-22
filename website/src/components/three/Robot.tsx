"use client";

import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { RobotController } from "@/lib/core/RobotController";
import type { ClipTable, PartCatalogue } from "@/lib/core/types";
import { MODEL_URL } from "@/lib/site";
import clips from "@/data/clips.json";
import parts from "@/data/parts.json";
import { useRobot } from "./RobotContext";

export interface RobotProps {
  clip?: string;
  interactive?: boolean;
  inPlace?: boolean;
  /** Force every clip to loop (hero / showcase canvases). */
  loop?: boolean;
}

export function Robot({ clip = "idle", interactive = false, inPlace = false, loop }: RobotProps) {
  const gltf = useGLTF(MODEL_URL);
  const { setCtrl, setHovered, setSelected, selected } = useRobot();

  const ctrl = useMemo(
    () => new RobotController(gltf.scene, gltf.animations, parts as unknown as PartCatalogue, clips as ClipTable),
    [gltf],
  );

  useEffect(() => {
    setCtrl(ctrl);
    return () => {
      setCtrl(null);
      ctrl.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrl]);

  useEffect(() => {
    ctrl.setClip(clip);
  }, [ctrl, clip]);

  useEffect(() => {
    ctrl.inPlace = inPlace;
  }, [ctrl, inPlace]);

  useEffect(() => {
    ctrl.loopOverride = loop ?? null;
  }, [ctrl, loop]);

  useFrame((_, dt) => {
    ctrl.update(Math.min(dt, 0.1));
  });

  const handlers = interactive
    ? {
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(ctrl.ownerOf(e.object));
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          setHovered(null);
          document.body.style.cursor = "";
        },
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          // ignore clicks that were really orbit drags
          if (e.delta > 4) return;
          const name = ctrl.ownerOf(e.object);
          setSelected(name === selected ? null : name);
        },
      }
    : {};

  return <primitive object={gltf.scene} {...handlers} />;
}

useGLTF.preload(MODEL_URL);
