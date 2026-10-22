"use client";

import { useMemo, useState } from "react";
import { useRobot } from "@/components/three/RobotContext";
import { CATEGORY_META, type PartCatalogue, type PartCategory } from "@/lib/core/types";
import partsJson from "@/data/parts.json";

const parts = partsJson as unknown as PartCatalogue;

const GROUP_ORDER = ["Body", "Arm", "Leg FL", "Leg FR", "Leg RL", "Leg RR", "Props"];

export function PartsBrowser({ onPick }: { onPick?: () => void }) {
  const { selected, setSelected, setHovered, requestCamera } = useRobot();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ Body: true, Arm: true });

  const groups = useMemo(() => {
    const out = new Map<string, [string, PartCatalogue[string]][]>();
    const needle = q.trim().toLowerCase();
    for (const [name, p] of Object.entries(parts)) {
      if (needle && !`${p.title} ${p.category} ${p.group}`.toLowerCase().includes(needle)) continue;
      if (!out.has(p.group)) out.set(p.group, []);
      out.get(p.group)!.push([name, p]);
    }
    return [...out.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]));
  }, [q]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b hairline p-3">
        <p className="label mb-2">Components · {Object.keys(parts).length}</p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search motors, pistons, gears…"
          className="w-full rounded border border-line-2 bg-ink px-3 py-2 text-sm placeholder:text-mute focus:border-signal focus:outline-none"
        />
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
        {groups.map(([group, list]) => {
          const isOpen = q ? true : (open[group] ?? false);
          return (
            <div key={group} className="mb-1">
              <button
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-soft hover:bg-panel-2"
                onClick={() => setOpen((o) => ({ ...o, [group]: !isOpen }))}
              >
                <span>{group}</span>
                <span className="font-mono text-mute">
                  {list.length} {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <ul>
                  {list.map(([name, p]) => (
                    <li key={name}>
                      <button
                        onMouseEnter={() => setHovered(name)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => {
                          setSelected(name);
                          requestCamera({ kind: "focus", part: name });
                          onPick?.();
                        }}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${
                          selected === name ? "bg-signal/15 text-fg" : "text-soft hover:bg-panel-2 hover:text-fg"
                        }`}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: CATEGORY_META[p.category as PartCategory]?.color }} />
                        <span className="truncate">{p.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PartInspector() {
  const { selected, setSelected, ctrl, requestCamera } = useRobot();
  const [iso, setIso] = useState(false);
  if (!selected || !parts[selected]) return null;
  const p = parts[selected];
  const cat = CATEGORY_META[p.category as PartCategory];
  return (
    <div className="pointer-events-auto w-full rounded-md border border-line-2 bg-panel/95 shadow-2xl shadow-black/50 backdrop-blur sm:w-[340px]">
      <div className="flex items-start gap-3 border-b hairline p-4">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: cat?.color }} />
            <span className="label">
              {cat?.label} · {p.group}
            </span>
          </div>
          <h3 className="text-lg font-semibold leading-tight">{p.title}</h3>
          <p className="mt-0.5 font-mono text-[11px] text-mute">{selected}</p>
        </div>
        <button
          onClick={() => {
            setSelected(null);
            ctrl?.setIsolate(false);
            setIso(false);
          }}
          className="rounded px-2 py-1 font-mono text-xs text-mute hover:bg-panel-2 hover:text-fg"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>
      <div className="max-h-[38vh] overflow-y-auto p-4 scrollbar-thin sm:max-h-[50vh]">
        <p className="text-sm leading-relaxed text-soft">{p.description}</p>
        {Object.keys(p.specs).length > 0 && (
          <dl className="mt-4 divide-y divide-line rounded border border-line">
            {Object.entries(p.specs).map(([k, v]) => (
              <div key={k} className="flex gap-3 px-3 py-2 text-[13px]">
                <dt className="w-[45%] shrink-0 text-mute">{k}</dt>
                <dd className="font-mono text-fg">{v}</dd>
              </div>
            ))}
            {p.mass_kg > 0 && (
              <div className="flex gap-3 px-3 py-2 text-[13px]">
                <dt className="w-[45%] shrink-0 text-mute">Mass (est.)</dt>
                <dd className="font-mono text-fg">{p.mass_kg.toFixed(2)} kg</dd>
              </div>
            )}
          </dl>
        )}
      </div>
      <div className="flex gap-2 border-t hairline p-3">
        <button
          onClick={() => requestCamera({ kind: "focus", part: selected })}
          className="flex-1 rounded border border-line-2 py-1.5 text-xs text-soft hover:border-signal hover:text-fg"
        >
          Focus camera
        </button>
        <button
          onClick={() => {
            ctrl?.setIsolate(!iso);
            setIso(!iso);
          }}
          className={`flex-1 rounded border py-1.5 text-xs ${iso ? "border-signal text-fg" : "border-line-2 text-soft hover:border-signal hover:text-fg"}`}
        >
          {iso ? "Show all" : "Isolate part"}
        </button>
      </div>
    </div>
  );
}
