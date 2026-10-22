"use client";

import { useState } from "react";
import { LazyScene } from "@/components/three/LazyScene";
import { RobotProvider } from "@/components/three/RobotContext";

const QUICK = [
  { id: "idle", label: "Idle" },
  { id: "walk", label: "Walk" },
  { id: "interact", label: "Pick & place" },
  { id: "exploded", label: "Exploded" },
];

export function HomeHero() {
  const [clip, setClip] = useState("idle");
  return (
    <RobotProvider initialAutoRotate>
      <div className="relative -mx-4 h-[56vh] min-h-[360px] sm:mx-0 lg:h-[78vh]">
        <LazyScene className="absolute inset-0" clip={clip} inPlace={clip === "walk"} loop initialView="iso" maxDistance={5} quality={1} />
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-1.5 sm:left-auto">
          {QUICK.map((q) => (
            <button
              key={q.id}
              onClick={() => setClip(q.id)}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] backdrop-blur ${
                clip === q.id ? "border-signal bg-signal/15 text-fg" : "border-line-2 bg-ink/70 text-soft hover:text-fg"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </RobotProvider>
  );
}
