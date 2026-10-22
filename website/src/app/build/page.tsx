import type { Metadata } from "next";
import Image from "next/image";
import { asset } from "@/lib/site";
import clips from "@/data/clips.json";
import parts from "@/data/parts.json";

export const metadata: Metadata = {
  title: "Build Process",
  description: "How ARGO-Q4 was engineered: kinematics in Python, procedural modelling in Blender, animation baking and the web/mobile pipeline.",
};

const STEPS = [
  {
    n: "01",
    t: "Requirements & kinematic layout",
    d: "Fixed the leg geometry (320 / 340 mm links, 0.62 m stance height), the arm reach (0.93 m) and the stance width first. Every later decision — motor placement, panel cut-outs, the side-by-side elbow — is constrained by these numbers.",
    code: `HIP_X, HIP_Y, HIP_W = 0.40, 0.12, 0.10
L_THIGH, L_SHIN    = 0.32, 0.34
L_UPPER, L_FORE    = 0.40, 0.36   # forearm runs beside upper arm
STAND_Z, CROUCH_Z  = 0.62, 0.13`,
  },
  {
    n: "02",
    t: "Analytic inverse kinematics",
    d: "A closed-form 3-DOF leg solver (abduction plane + two-link planar IK, knees rearward) and a 5-DOF arm solver with approach angle and lateral elbow offset. Both round-trip through forward kinematics to < 1 µm in the test suite.",
    code: `def leg_ik(leg, foot_body):
    d    = hypot(ry, rz)
    abd  = atan2(rz, ry) + acos(sy * HIP_W / d)
    ...
    kx, kz = min(candidates, key=lambda k: k[0])  # knee behind
    return abd, atan2(-kx, -kz), wrap(shin - hip)`,
  },
  {
    n: "03",
    t: "Gait planning & choreography",
    d: "A diagonal trot with Raibert-style foothold placement keeps every stance foot fixed in the world while the body accelerates and brakes. Ten clips are written as functions of time using minimum-jerk (quintic) servo moves.",
    code: `class TrotGait:
    def foot(self, leg, t):
        if t < stance_end:              # planted
            return (foothold(k), y, FOOT_R)
        u = (t - stance_end) / swing    # swing arc
        x = lerp(x0, x1, min_jerk(u))`,
  },
  {
    n: "04",
    t: "Hydraulic actuator sizing",
    d: "A grid search placed the knee cylinder clevises so a single telescoping cylinder covers the full 112° knee range. The build script then measures the real stroke over all 2 490 frames and sizes barrel and rod automatically.",
    code: `dmin, dmax = 0.264, 0.471     # measured, metres
Lr = dmin - 0.02               # rod never bottoms out
Lc = dmax - Lr + overlap       # rod never leaves barrel
assert Lc < dmin - 0.006       # physically telescopes`,
  },
  {
    n: "05",
    t: "Procedural modelling (bmesh)",
    d: "A small mesh builder composes bevelled boxes, tapered beams, involute-style gear profiles, tori, swept hoses and helical springs into ~70 named components, each tagged with engineering metadata for the viewers.",
    code: `mb = MB()
mb.cyl(0.055, 0.12, pos, AX_X, "Anodized_Graphite", bevel=0.004)
mb.fins(0.055, 0.062, 5, 0.017, pos, AX_X)
mb.bolt_circle(8, 0.046, flange, AX_X)
part(mb, "Hip_Abd_Motor_FL", body, "actuator", ...)`,
  },
  {
    n: "06",
    t: "Animation baking",
    d: "One pass samples every frame: joints, aimed hydraulic cylinders, gear speeds coupled by tooth count, a payload spring-damper, a crate that follows the gripper and then falls under gravity, and per-part exploded offsets. Written straight to F-curves.",
    code: `for f in frames:
    pose = clip.fn(t)
    apply(pose); view_layer.update()
    cyl.rotation_quaternion = aim(A_world, B_world)
    gear_idler.rz = -drive * 20 / 14
    rec.rec(...)`,
  },
  {
    n: "07",
    t: "Export & runtime",
    d: "The whole 83 s timeline exports as a single GLB with part metadata in glTF extras. A framework-agnostic RobotController plays clips by driving the mixer inside each clip's frame window — shared by the website and the Android app.",
    code: `action.time = keyOffset + (clip.start - 1) / fps + t
mixer.update(0)
glow.emissiveIntensity = base * powerNode.scale.x`,
  },
];

const GALLERY = [
  ["01_hero", "Idle, hero camera"],
  ["04_walk_side", "Trot gait, side tracking camera"],
  ["05_knee_hydraulics", "Knee hydraulics detail"],
  ["06_pick_crate", "Lifting the 2 kg sample crate"],
  ["07_stow_crate", "Crate stowed on the cargo deck"],
  ["08_internals_xray", "Shell hidden: gears, battery, compute"],
  ["09_exploded", "Exploded assembly"],
  ["02_parked", "Parked on the skid plate"],
];

export default function BuildPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6">
      <header className="mb-14 max-w-3xl">
        <p className="label mb-3">Build process</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Code first, then geometry, then pixels.</h1>
        <p className="mt-4 leading-relaxed text-soft">
          ARGO-Q4 is fully reproducible: one Python script rebuilds the {Object.values(parts).filter((p) => p.category !== "prop").length}-component model, bakes{" "}
          {clips.frame_end.toLocaleString()} frames across {clips.clips.length} sequences and exports the asset used here and in
          the Android app.
        </p>
      </header>

      <ol className="relative space-y-10 border-l border-line pl-6 sm:pl-10">
        {STEPS.map((s) => (
          <li key={s.n} className="relative grid gap-5 lg:grid-cols-[1fr_1.1fr]">
            <span className="absolute -left-[33px] top-1 grid h-4 w-4 place-items-center rounded-full border border-signal bg-ink sm:-left-[49px]">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            </span>
            <div>
              <p className="font-mono text-xs text-signal">STEP {s.n}</p>
              <h2 className="mt-1 text-xl font-semibold">{s.t}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-soft">{s.d}</p>
            </div>
            <pre className="overflow-x-auto rounded-md border border-line bg-panel p-4 font-mono text-[12.5px] leading-relaxed text-soft scrollbar-thin">
              <code>{s.code}</code>
            </pre>
          </li>
        ))}
      </ol>

      <section className="mt-20">
        <p className="label mb-3">Renders</p>
        <h2 className="text-2xl font-semibold">Blender EEVEE stills</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GALLERY.map(([f, cap]) => (
            <figure key={f} className="overflow-hidden rounded-md border border-line bg-panel">
              <Image src={asset(`/renders/${f}.jpg`)} alt={cap} width={1920} height={1080} className="aspect-video w-full object-cover" />
              <figcaption className="px-3 py-2 text-xs text-mute">{cap}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <p className="label mb-3">Architecture</p>
        <h2 className="text-2xl font-semibold">One source of truth, three outputs</h2>
        <div className="mt-6 overflow-x-auto rounded-md border border-line bg-panel/50 p-6">
          <svg viewBox="0 0 900 250" className="h-auto min-w-[720px] w-full" role="img" aria-label="Pipeline architecture">
            <g fontFamily="monospace" fontSize="12">
              {[
                [20, "argo/motion.py", "IK · gait · clips", "#38d6ff"],
                [250, "build_robot.py", "bmesh · bake · export", "#ff5a1f"],
                [480, "argo_q4.glb", "+ parts.json · clips.json", "#e8ecf1"],
              ].map(([x, a, b, c]) => (
                <g key={a as string}>
                  <rect x={x as number} y="90" width="190" height="70" rx="6" fill="#0d1116" stroke={c as string} />
                  <text x={(x as number) + 14} y="120" fill="#e8ecf1">{a}</text>
                  <text x={(x as number) + 14} y="140" fill="#7c8796">{b}</text>
                </g>
              ))}
              <path d="M210 125 H250 M440 125 H480" stroke="#7c8796" markerEnd="url(#arr)" />
              {[
                [30, "Website", "Next.js · R3F"],
                [110, "Android APK", "RN shell + WebView"],
                [190, "Renders", "EEVEE stills"],
              ].map(([y, a, b]) => (
                <g key={a as string}>
                  <rect x="720" y={y as number} width="160" height="50" rx="6" fill="#0d1116" stroke="#2b3542" />
                  <text x="734" y={(y as number) + 22} fill="#e8ecf1">{a}</text>
                  <text x="734" y={(y as number) + 39} fill="#7c8796">{b}</text>
                  <path d={`M670 125 C 700 125, 690 ${(y as number) + 25}, 720 ${(y as number) + 25}`} stroke="#7c8796" fill="none" markerEnd="url(#arr)" />
                </g>
              ))}
              <text x="250" y="200" fill="#7c8796">tests/test_motion.py — IK round-trip, planted feet, joint limits</text>
            </g>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" fill="#7c8796" />
              </marker>
            </defs>
          </svg>
        </div>
      </section>
    </div>
  );
}
