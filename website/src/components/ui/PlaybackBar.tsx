"use client";

import { usePlayback, useRobot } from "@/components/three/RobotContext";
import clips from "@/data/clips.json";

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

export function fmt(t: number) {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

export function ClipPills({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
      {clips.clips.map((c, i) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={`shrink-0 rounded border px-2.5 py-1.5 text-xs transition-colors ${
            value === c.id ? "border-signal bg-signal/15 text-fg" : "border-line-2 text-soft hover:border-soft hover:text-fg"
          }`}
        >
          <span className="mr-1.5 font-mono text-[10px] text-mute">{String(i + 1).padStart(2, "0")}</span>
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function PlaybackBar({ onClip }: { onClip?: (id: string) => void }) {
  const { ctrl } = useRobot();
  const s = usePlayback();
  if (!ctrl || !s) return null;
  const pct = s.duration ? (s.time / s.duration) * 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      <ClipPills
        value={s.clipId}
        onChange={(id) => {
          ctrl.setClip(id);
          onClip?.(id);
        }}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => ctrl.toggle()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded bg-signal text-ink hover:bg-signal-soft"
          aria-label={s.playing ? "Pause" : "Play"}
        >
          {s.playing ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
              <rect x="3" y="2" width="3.5" height="12" />
              <rect x="9.5" y="2" width="3.5" height="12" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
              <path d="M4 2l10 6-10 6z" />
            </svg>
          )}
        </button>
        <span className="w-14 shrink-0 text-right font-mono text-xs text-soft">{fmt(s.time)}</span>
        <input
          type="range"
          className="scrub"
          min={0}
          max={1000}
          value={Math.round(pct * 10)}
          style={{ "--p": `${pct}%` } as React.CSSProperties}
          onChange={(e) => {
            ctrl.pause();
            ctrl.seek(Number(e.target.value) / 1000);
          }}
          aria-label="Timeline"
        />
        <span className="w-14 shrink-0 font-mono text-xs text-mute">{fmt(s.duration)}</span>
        <select
          value={s.speed}
          onChange={(e) => ctrl.setSpeed(Number(e.target.value))}
          className="hidden rounded border border-line-2 bg-panel px-1.5 py-1 font-mono text-xs text-soft sm:block"
          aria-label="Playback speed"
        >
          {SPEEDS.map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            ctrl.loopOverride = !s.loop;
            ctrl.play();
          }}
          className={`hidden rounded border px-2 py-1 font-mono text-xs sm:block ${s.loop ? "border-glow text-glow" : "border-line-2 text-mute"}`}
          aria-pressed={s.loop}
        >
          LOOP
        </button>
      </div>
    </div>
  );
}
