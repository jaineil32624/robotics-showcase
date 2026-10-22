"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LazyScene } from "@/components/three/LazyScene";
import { RobotProvider, type ViewPreset, usePlayback, useRobot } from "@/components/three/RobotContext";
import { PartInspector, PartsBrowser } from "@/components/ui/PartsPanel";
import { PlaybackBar } from "@/components/ui/PlaybackBar";
import clips from "@/data/clips.json";
import parts from "@/data/parts.json";

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: "iso", label: "Iso" },
  { id: "front", label: "Front" },
  { id: "side", label: "Side" },
  { id: "top", label: "Top" },
  { id: "rear", label: "Rear" },
  { id: "detail", label: "Detail" },
];

function Toggle({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`rounded border px-2.5 py-1.5 font-mono text-[11px] tracking-wide transition-colors ${
        on ? "border-glow bg-glow/10 text-glow" : "border-line-2 bg-panel/80 text-soft hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ stats, setStats }: { stats: boolean; setStats: (b: boolean) => void }) {
  const { ctrl, requestCamera, autoRotate, setAutoRotate, follow, setFollow } = useRobot();
  const [xray, setXray] = useState(false);
  const [wire, setWire] = useState(false);
  const [inPlace, setInPlace] = useState(false);
  const [explode, setExplode] = useState(0);
  const s = usePlayback();
  useEffect(() => {
    if (s && s.clipId !== "exploded" && explode !== 0) setExplode(0);
  }, [s, explode]);
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => requestCamera({ kind: "preset", preset: v.id })}
            className="rounded border border-line-2 bg-panel/80 px-2.5 py-1.5 font-mono text-[11px] text-soft backdrop-blur hover:border-signal hover:text-fg"
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        <Toggle
          on={xray}
          title="Hide the shell panels to reveal internal machinery"
          onClick={() => {
            ctrl?.setXray(!xray);
            setXray(!xray);
          }}
        >
          X-RAY
        </Toggle>
        <Toggle
          on={wire}
          onClick={() => {
            ctrl?.setWireframe(!wire);
            setWire(!wire);
          }}
        >
          WIRE
        </Toggle>
        <Toggle on={autoRotate} onClick={() => setAutoRotate(!autoRotate)}>
          ORBIT
        </Toggle>
        <Toggle on={follow} title="Camera follows the robot while walking" onClick={() => setFollow(!follow)}>
          FOLLOW
        </Toggle>
        <Toggle
          on={inPlace}
          title="Lock the root so walk cycles play on the spot"
          onClick={() => {
            if (ctrl) ctrl.inPlace = !inPlace;
            setInPlace(!inPlace);
          }}
        >
          IN-PLACE
        </Toggle>
        <Toggle on={stats} onClick={() => setStats(!stats)}>
          STATS
        </Toggle>
      </div>
      <label className="flex items-center gap-2 rounded border border-line-2 bg-panel/80 px-3 py-1.5 backdrop-blur">
        <span className="font-mono text-[11px] text-soft">EXPLODE</span>
        <input
          type="range"
          className="scrub w-28 sm:w-36"
          min={0}
          max={100}
          value={explode}
          style={{ "--p": `${explode}%` } as React.CSSProperties}
          onChange={(e) => {
            const v = Number(e.target.value);
            setExplode(v);
            ctrl?.setExplode(v / 100);
          }}
        />
      </label>
    </div>
  );
}

function Telemetry({ perf }: { perf: { fps: number; calls: number; tris: number } | null }) {
  const { ctrl } = useRobot();
  const s = usePlayback();
  if (!ctrl || !s) return null;
  const clip = clips.clips.find((c) => c.id === s.clipId);
  return (
    <div className="pointer-events-none rounded border border-line-2 bg-panel/80 px-3 py-2 font-mono text-[11px] leading-5 text-soft backdrop-blur">
      <div className="flex items-center gap-2 text-fg">
        <span className={`h-1.5 w-1.5 rounded-full ${ctrl.power > 0.5 ? "bg-ok" : "bg-signal"}`} />
        {clip?.label}
      </div>
      <div>
        POWER <span className="text-fg">{(ctrl.power * 100).toFixed(0)}%</span> · FRAME{" "}
        <span className="text-fg">{clip ? clip.start + Math.round(s.time * clips.fps) : 0}</span>
      </div>
      <div>
        PARTS <span className="text-fg">{Object.keys(parts).length}</span> · DOF <span className="text-fg">18</span>
      </div>
      {perf && (
        <div>
          {perf.fps.toFixed(0)} FPS · {perf.calls} calls · {(perf.tris / 1000).toFixed(0)}k tris
        </div>
      )}
    </div>
  );
}

function Workspace() {
  const params = useSearchParams();
  const initialClip = params.get("clip") ?? "idle";
  const { selected } = useRobot();
  const [clip, setClip] = useState(initialClip);
  const [stats, setStats] = useState(false);
  const [perf, setPerf] = useState<{ fps: number; calls: number; tris: number } | null>(null);
  const [sheet, setSheet] = useState(false);

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* desktop component browser */}
      <aside className="hidden w-72 shrink-0 border-r hairline bg-panel lg:block">
        <PartsBrowser />
      </aside>

      <section className="relative flex-1">
        <LazyScene className="absolute inset-0" clip={clip} interactive showStats={stats ? setPerf : undefined} />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
          <div className="hidden sm:block">
            <Telemetry perf={stats ? perf : null} />
          </div>
          <Toolbar stats={stats} setStats={setStats} />
        </div>

        {/* inspector: right column on desktop, bottom sheet on mobile */}
        {selected && (
          <div className="pointer-events-none absolute inset-x-3 bottom-[132px] z-10 flex justify-end sm:inset-x-auto sm:right-3 sm:top-[118px] sm:bottom-auto">
            <PartInspector />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 border-t hairline bg-ink/85 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-end gap-3">
            <button
              className="shrink-0 rounded border border-line-2 px-3 py-2 font-mono text-xs text-soft lg:hidden"
              onClick={() => setSheet(true)}
            >
              PARTS
            </button>
            <div className="min-w-0 flex-1">
              <PlaybackBar onClip={setClip} />
            </div>
          </div>
          <p className="mt-2 hidden text-center text-[11px] text-mute md:block">
            Drag to orbit · scroll / pinch to zoom · right-drag to pan · click any component to inspect it
          </p>
        </div>
      </section>

      {/* mobile parts sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/60 backdrop-blur-sm lg:hidden" onClick={() => setSheet(false)}>
          <div className="mt-auto h-[72dvh] rounded-t-lg border-t border-line-2 bg-panel" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b hairline px-4 py-2">
              <span className="label">Component browser</span>
              <button className="font-mono text-xs text-soft" onClick={() => setSheet(false)}>
                CLOSE
              </button>
            </div>
            <div className="h-[calc(72dvh-41px)]">
              <PartsBrowser onPick={() => setSheet(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ViewerWorkspace() {
  return (
    <RobotProvider>
      <Workspace />
    </RobotProvider>
  );
}
