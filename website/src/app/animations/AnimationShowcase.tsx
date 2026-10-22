"use client";

import Link from "next/link";
import { useState } from "react";
import { LazyScene } from "@/components/three/LazyScene";
import { RobotProvider, usePlayback, useRobot } from "@/components/three/RobotContext";
import { PlaybackBar, fmt } from "@/components/ui/PlaybackBar";
import clips from "@/data/clips.json";

const TECH: Record<string, string[]> = {
  power_on: ["Emission driven by Power_Level node", "Fan & pump ω ramps", "Sequential servo self-test"],
  startup: ["Feet planted via IK", "Minimum-jerk stand-up", "Arm unfold over the top"],
  idle: ["Seamless 4 s period", "All channels periodic", "Turret scan"],
  joint_demo: ["Weight shift before lift-off", "Each joint isolated", "6-DOF body posture with planted feet"],
  walk: ["Diagonal trot, duty 0.6", "Raibert foothold placement", "Acceleration lean"],
  arm: ["Analytic 5-DOF arm IK", "5 workspace waypoints", "Wrist roll + gripper"],
  interact: ["Grasp attaches crate to gripper", "Spring-damper payload sag", "Ballistic drop on release"],
  full: ["Trot at 0.5 m/s", "Lidar at 2× rate", "Scanning arm"],
  shutdown: ["Stow before park", "Spin-down curves", "Power fade"],
  exploded: ["Per-part assembly vectors", "Body-frame offsets", "Re-assembly"],
};

function Timeline() {
  const { ctrl } = useRobot();
  const s = usePlayback();
  const total = clips.frame_end;
  return (
    <div className="flex h-9 w-full overflow-hidden rounded border border-line">
      {clips.clips.map((c, i) => {
        const active = s?.clipId === c.id;
        const p = active && s ? (s.time / s.duration) * 100 : 0;
        return (
          <button
            key={c.id}
            onClick={() => ctrl?.setClip(c.id)}
            title={c.label}
            style={{ width: `${(c.frames / total) * 100}%` }}
            className={`relative border-r border-line text-left last:border-r-0 ${active ? "bg-signal/15" : "hover:bg-panel-2"}`}
          >
            {active && <span className="absolute inset-y-0 left-0 bg-signal/25" style={{ width: `${p}%` }} />}
            <span className="relative block truncate px-1.5 font-mono text-[10px] text-soft">{String(i + 1).padStart(2, "0")}</span>
          </button>
        );
      })}
    </div>
  );
}

function Cards() {
  const { ctrl } = useRobot();
  const s = usePlayback();
  return (
    <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
      {clips.clips.map((c, i) => {
        const active = s?.clipId === c.id;
        return (
          <article key={c.id} className={`flex flex-col bg-ink p-5 ${active ? "bg-panel" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="label">
                {String(i + 1).padStart(2, "0")} · frames {c.start}–{c.end}
              </span>
              <span className="font-mono text-xs text-mute">{fmt(c.dur)}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">
              {c.label}
              {c.loop && <span className="ml-2 align-middle font-mono text-[10px] text-glow">LOOP</span>}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-soft">{c.desc}</p>
            <ul className="mt-4 space-y-1">
              {(TECH[c.id] ?? []).map((t) => (
                <li key={t} className="flex gap-2 text-[13px] text-mute">
                  <span className="text-signal">—</span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  ctrl?.setClip(c.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`rounded px-3 py-1.5 text-xs font-semibold ${active ? "bg-signal text-ink" : "border border-line-2 text-fg hover:border-signal"}`}
              >
                {active ? "Playing" : "Play"}
              </button>
              <Link href={`/viewer/?clip=${c.id}`} className="rounded border border-line-2 px-3 py-1.5 text-xs text-soft hover:text-fg">
                Inspect in viewer
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function AnimationShowcase() {
  const [clip] = useState("power_on");
  return (
    <RobotProvider>
      <section className="border-b hairline">
        <div className="relative h-[58vh] min-h-[360px]">
          <LazyScene className="absolute inset-0" clip={clip} initialView="iso" quality={2} />
          <div className="pointer-events-none absolute left-4 top-4 sm:left-6 sm:top-6">
            <p className="label">Animation showcase</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Every moving part, on purpose.</h1>
          </div>
        </div>
        <div className="mx-auto max-w-[1400px] space-y-3 px-4 py-4 sm:px-6">
          <Timeline />
          <PlaybackBar />
        </div>
      </section>
      <section className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-6">
        <Cards />
      </section>
    </RobotProvider>
  );
}
