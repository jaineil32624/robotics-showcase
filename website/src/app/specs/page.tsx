import type { Metadata } from "next";
import { JOINTS, SPEC_GROUPS } from "@/data/specs";
import { CATEGORY_META, type PartCatalogue, type PartCategory } from "@/lib/core/types";
import partsJson from "@/data/parts.json";
import { KinematicDiagram } from "./KinematicDiagram";

export const metadata: Metadata = {
  title: "Engineering Specifications",
  description: "Dimensions, kinematics, actuators, power and hydraulic specifications for ARGO-Q4.",
};

const parts = partsJson as unknown as PartCatalogue;

export default function SpecsPage() {
  const robot = Object.entries(parts).filter(([, p]) => p.category !== "prop");
  const total = robot.reduce((a, [, p]) => a + p.mass_kg, 0);
  const byCat = new Map<PartCategory, number>();
  for (const [, p] of robot) byCat.set(p.category, (byCat.get(p.category) ?? 0) + p.mass_kg);
  const massRows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const actuators = robot.filter(([, p]) => p.category === "actuator" || p.title.startsWith("Knee Hydraulic"));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6">
      <header className="mb-12 grid gap-6 border-b hairline pb-10 lg:grid-cols-[2fr_1fr] lg:items-end">
        <div>
          <p className="label mb-3">Datasheet · ARGO-Q4 R1</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Engineering specifications</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-soft">
            Geometry is taken directly from the kinematic model that drives the Blender build, so every dimension here matches
            the 3D asset. Performance figures are design targets for this concept prototype.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line">
          <div className="bg-ink p-4">
            <dt className="label">Mass (sum of parts)</dt>
            <dd className="mt-1 font-mono text-2xl">{total.toFixed(1)} kg</dd>
          </div>
          <div className="bg-ink p-4">
            <dt className="label">Components</dt>
            <dd className="mt-1 font-mono text-2xl">{robot.length}</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {SPEC_GROUPS.map((g) => (
          <section key={g.id} className="rounded-md border border-line">
            <h2 className="border-b hairline px-4 py-3 text-sm font-semibold uppercase tracking-wider text-soft">{g.title}</h2>
            <dl className="divide-y divide-line">
              {g.rows.map((r) => (
                <div key={r.k} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2.5 text-sm">
                  <dt className="text-mute">
                    {r.k}
                    {r.note && <span className="block text-[11px] text-signal/80">{r.note}</span>}
                  </dt>
                  <dd className="text-right font-mono text-fg">{r.v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section className="mt-16 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div>
          <p className="label mb-3">Kinematics</p>
          <h2 className="text-2xl font-semibold">Joint table</h2>
          <div className="mt-5 overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-panel text-left">
                <tr>
                  {["Joint", "Axis", "Range used", "Drive"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wider text-mute">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {JOINTS.map((j) => (
                  <tr key={j.joint}>
                    <td className="px-4 py-2.5">{j.joint}</td>
                    <td className="px-4 py-2.5 font-mono text-soft">{j.axis}</td>
                    <td className="px-4 py-2.5 font-mono">{j.range}</td>
                    <td className="px-4 py-2.5 text-soft">{j.drive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <p className="label mb-3">Leg & arm geometry</p>
          <h2 className="text-2xl font-semibold">Kinematic chain</h2>
          <div className="mt-5 rounded-md border border-line bg-panel/40 p-4">
            <KinematicDiagram />
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-2">
        <div>
          <p className="label mb-3">Mass budget</p>
          <h2 className="text-2xl font-semibold">Mass by subsystem</h2>
          <ul className="mt-5 space-y-2.5">
            {massRows.map(([cat, m]) => (
              <li key={cat}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-soft">{CATEGORY_META[cat]?.label ?? cat}</span>
                  <span className="font-mono">
                    {m.toFixed(2)} kg <span className="text-mute">· {((m / total) * 100).toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-line">
                  <div className="h-full rounded-sm" style={{ width: `${(m / massRows[0][1]) * 100}%`, background: CATEGORY_META[cat]?.color }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label mb-3">Actuation</p>
          <h2 className="text-2xl font-semibold">Actuator register</h2>
          <div className="mt-5 max-h-[460px] overflow-y-auto rounded-md border border-line scrollbar-thin">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {actuators.map(([name, p]) => {
                  const first = Object.entries(p.specs)[0];
                  return (
                    <tr key={name}>
                      <td className="px-4 py-2.5">{p.title}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-soft">{first ? `${first[0]}: ${first[1]}` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
