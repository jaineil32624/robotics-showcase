import Link from "next/link";
import { HomeHero } from "./HomeHero";
import { HEADLINE } from "@/data/specs";
import clips from "@/data/clips.json";
import parts from "@/data/parts.json";

const SYSTEMS = [
  {
    k: "Locomotion",
    t: "Four 3-DOF hydraulic legs",
    d: "Abduction torque motors, strain-wave hip servos and hydraulic knees driven through a heel lever — the leg's quadriceps.",
    n: "12 joints",
  },
  {
    k: "Hydraulics",
    t: "21 MPa power unit",
    d: "Axial-piston pump, reservoir, braided hose set and four double-acting cylinders whose stroke was sized from the baked animation.",
    n: "207 mm stroke",
  },
  {
    k: "Manipulation",
    t: "5-DOF arm + gripper",
    d: "Slewing turret, shoulder, side-by-side elbow so the arm folds flat, wrist pitch, continuous wrist roll and a lead-screw parallel gripper.",
    n: "0.93 m reach",
  },
  {
    k: "Drivetrain",
    t: "Accessory gear train",
    d: "Module-4 spur gears (20 / 14 / 28 teeth). Their rotation in every animation is coupled by tooth count, not hand-keyed.",
    n: "1 : 0.714 ratio",
  },
  {
    k: "Perception",
    t: "Lidar + stereo depth",
    d: "A 32-channel spinning lidar for SLAM and a global-shutter stereo pair with an IR projector inside a sealed visor.",
    n: "640k pts/s",
  },
  {
    k: "Power",
    t: "1.15 kWh, 48 V",
    d: "63-cell 21700 pack, supercapacitor regen buffer and a distribution core whose glow tracks bus charge through every sequence.",
    n: "≈ 2.4 h",
  },
];

export default function Home() {
  const nParts = Object.values(parts).filter((p) => p.category !== "prop").length;
  return (
    <>
      <section className="relative overflow-hidden border-b hairline">
        <div className="blueprint pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-[1400px] gap-6 px-4 pt-10 sm:px-6 lg:min-h-[78vh] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:pt-0">
          <div className="relative z-10 max-w-xl py-4 lg:py-16">
            <p className="label mb-5">
              <span className="text-signal">●</span> Robotics showcase · Concept prototype R1
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl" style={{ fontStretch: "118%" }}>
              ARGO<span className="text-signal">-</span>Q4
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-soft sm:text-xl">
              A hydraulic quadruped field robot with a 5-axis manipulator — modelled part by part in Blender, animated by
              real inverse kinematics, and inspectable down to every gear tooth in your browser.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/viewer/" className="rounded bg-signal px-5 py-3 text-sm font-semibold text-ink hover:bg-signal-soft">
                Open the 3D viewer
              </Link>
              <Link href="/animations/" className="rounded border border-line-2 px-5 py-3 text-sm text-fg hover:border-soft">
                Watch the sequences
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line">
              {[
                [String(nParts), "components"],
                [String(clips.clips.length), "sequences"],
                [String(clips.frame_end), "baked frames"],
              ].map(([v, k]) => (
                <div key={k} className="bg-ink px-4 py-3">
                  <dt className="label">{k}</dt>
                  <dd className="mt-1 font-mono text-2xl text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HomeHero />
        </div>
      </section>

      <section className="border-b hairline bg-panel/40">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
          {HEADLINE.map((h) => (
            <div key={h.k} className="bg-ink px-5 py-6">
              <p className="font-mono text-3xl text-fg">
                {h.v}
                <span className="ml-1 text-base text-signal">{h.u}</span>
              </p>
              <p className="mt-1 text-sm text-mute">{h.k}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6">
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label mb-3">Subsystems</p>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Built from real mechanisms, not primitives.</h2>
          </div>
          <Link href="/specs/" className="font-mono text-sm text-soft hover:text-signal">
            Full specification sheet →
          </Link>
        </div>
        <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
          {SYSTEMS.map((s, i) => (
            <article key={s.k} className="group bg-ink p-6 transition-colors hover:bg-panel">
              <div className="mb-6 flex items-center justify-between">
                <span className="label">
                  {String(i + 1).padStart(2, "0")} / {s.k}
                </span>
                <span className="font-mono text-xs text-signal">{s.n}</span>
              </div>
              <h3 className="text-xl font-semibold">{s.t}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-soft">{s.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y hairline bg-panel/40">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="label mb-3">Animation</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ten sequences, one continuous timeline.</h2>
            <p className="mt-4 max-w-lg leading-relaxed text-soft">
              Every pose is computed — leg inverse kinematics with planted feet, minimum-jerk servo moves, aimed hydraulic
              cylinders, gear ratios, a suspension spring that sags under the payload and a crate that falls under gravity.
            </p>
            <Link href="/animations/" className="mt-6 inline-block font-mono text-sm text-signal hover:text-signal-soft">
              Browse all sequences →
            </Link>
          </div>
          <ol className="divide-y divide-line rounded-md border border-line">
            {clips.clips.map((c, i) => (
              <li key={c.id}>
                <Link href={`/viewer/?clip=${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-panel">
                  <span className="font-mono text-xs text-mute">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-[15px]">{c.label}</span>
                  <span className="font-mono text-xs text-mute">{c.dur.toFixed(1)} s</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6">
        <p className="label mb-3">Pipeline</p>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">From a Python kinematics model to a phone in your pocket.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            ["Kinematics", "Pure-Python IK, gait planner and choreography, unit-tested outside Blender."],
            ["Blender", "bmesh builds ~70 parts, bakes 2 490 frames and exports a single GLB."],
            ["Web", "Next.js + React Three Fiber viewer with part inspection and clip control."],
            ["Android", "React Native shell around the same three.js core, fully offline."],
          ].map(([t, d], i) => (
            <div key={t} className="rounded-md border border-line p-5">
              <p className="font-mono text-xs text-signal">STAGE {i + 1}</p>
              <h3 className="mt-2 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-soft">{d}</p>
            </div>
          ))}
        </div>
        <Link href="/build/" className="mt-8 inline-block font-mono text-sm text-soft hover:text-signal">
          Read the build process →
        </Link>
      </section>
    </>
  );
}
