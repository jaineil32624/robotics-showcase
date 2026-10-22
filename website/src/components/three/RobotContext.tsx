"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ControllerState, RobotController } from "@/lib/core/RobotController";

export type ViewPreset = "iso" | "front" | "side" | "top" | "rear" | "detail";

export interface CameraRequest {
  kind: "preset" | "focus";
  preset?: ViewPreset;
  part?: string;
  nonce: number;
}

interface Ctx {
  ctrl: RobotController | null;
  setCtrl: (c: RobotController | null) => void;
  selected: string | null;
  setSelected: (n: string | null) => void;
  hovered: string | null;
  setHovered: (n: string | null) => void;
  camera: CameraRequest | null;
  requestCamera: (r: Omit<CameraRequest, "nonce">) => void;
  follow: boolean;
  setFollow: (b: boolean) => void;
  autoRotate: boolean;
  setAutoRotate: (b: boolean) => void;
}

const RobotCtx = createContext<Ctx | null>(null);

export function RobotProvider({ children, initialAutoRotate = false }: { children: React.ReactNode; initialAutoRotate?: boolean }) {
  const [ctrl, setCtrl] = useState<RobotController | null>(null);
  const [selected, setSelectedState] = useState<string | null>(null);
  const [hovered, setHoveredState] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraRequest | null>(null);
  const [follow, setFollow] = useState(true);
  const [autoRotate, setAutoRotate] = useState(initialAutoRotate);

  const value = useMemo<Ctx>(
    () => ({
      ctrl,
      setCtrl,
      selected,
      setSelected: (n) => {
        setSelectedState(n);
        ctrl?.setSelected(n);
      },
      hovered,
      setHovered: (n) => {
        setHoveredState(n);
        ctrl?.setHovered(n);
      },
      camera,
      requestCamera: (r) => setCamera({ ...r, nonce: performance.now() }),
      follow,
      setFollow,
      autoRotate,
      setAutoRotate,
    }),
    [ctrl, selected, hovered, camera, follow, autoRotate],
  );
  return <RobotCtx.Provider value={value}>{children}</RobotCtx.Provider>;
}

export function useRobot() {
  const c = useContext(RobotCtx);
  if (!c) throw new Error("useRobot must be used inside <RobotProvider>");
  return c;
}

/** Subscribe to playback state (clip, time, playing...) at ~15 Hz. */
export function usePlayback(): ControllerState | null {
  const { ctrl } = useRobot();
  const [s, setS] = useState<ControllerState | null>(ctrl?.state ?? null);
  useEffect(() => {
    if (!ctrl) return;
    setS(ctrl.state);
    const unsub = ctrl.subscribe(setS);
    const id = window.setInterval(() => setS(ctrl.state), 66);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, [ctrl]);
  return s;
}
