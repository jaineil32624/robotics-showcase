import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About the Project",
  description: "Why ARGO-Q4 exists, what it demonstrates and the technology behind it.",
};

const STACK = [
  ["3D & animation", "Blender 5.2 · Python (bpy, bmesh) · EEVEE"],
  ["Kinematics", "Pure-Python IK, gait planner, minimum-jerk trajectories"],
  ["Web", "Next.js · React · Three.js · React Three Fiber · drei · Tailwind CSS"],
  ["Mobile", "React Native (Expo) · WebView renderer · AsyncStorage"],
  ["Delivery", "GitHub Actions · GitHub Pages · Gradle APK build"],
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-12 sm:px-6">
      <p className="label mb-3">About</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">An engineering prototype, built end-to-end in code.</h1>
      <div className="mt-8 space-y-5 text-[17px] leading-relaxed text-soft">
        <p>
          ARGO-Q4 is a concept for a field robot that can walk over rough ground and handle samples with its own arm — the kind of
          machine that could inspect industrial sites or support planetary-surface operations. The goal of this project was to
          design it the way a real robot is designed: kinematics first, actuators sized from the motion they must produce, and
          every moving part doing a job.
        </p>
        <p>
          Nothing in the model is hand-placed. A Python kinematics module defines the geometry and every pose; a Blender script
          builds the mechanism from motors, pistons, gears, bearings and hoses, bakes ten animation sequences and exports a single
          asset. The same asset powers this website and an offline Android app.
        </p>
        <p className="rounded-md border border-line bg-panel/60 p-4 text-[15px]">
          <span className="font-semibold text-fg">Honest scope:</span> ARGO-Q4 is a digital prototype. Geometry and motion are
          computed and verified in code; performance figures such as torque, battery runtime and hydraulic pressure are design
          targets, not test results from hardware.
        </p>
      </div>

      <section className="mt-14">
        <h2 className="text-xl font-semibold">Technology</h2>
        <dl className="mt-4 divide-y divide-line rounded-md border border-line">
          {STACK.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]">
              <dt className="text-mute">{k}</dt>
              <dd className="text-fg">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14 grid gap-6 sm:grid-cols-2">
        <div className="rounded-md border border-line p-5">
          <p className="label">Author</p>
          <p className="mt-2 text-lg font-semibold">{SITE.author}</p>
          <p className="mt-1 text-sm text-soft">Student developer — robotics, 3D and web.</p>
          <div className="mt-4 flex gap-4 text-sm">
            <a href={SITE.github} className="text-signal hover:text-signal-soft" target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
            <a href={SITE.linkedin} className="text-signal hover:text-signal-soft" target="_blank" rel="noreferrer">
              LinkedIn ↗
            </a>
          </div>
        </div>
        <div className="rounded-md border border-line p-5">
          <p className="label">Source & license</p>
          <p className="mt-2 text-lg font-semibold">MIT licensed</p>
          <p className="mt-1 text-sm text-soft">Blender scripts, website, mobile app and documentation are open source.</p>
          <a href={SITE.repo} className="mt-4 inline-block text-sm text-signal hover:text-signal-soft" target="_blank" rel="noreferrer">
            View repository ↗
          </a>
        </div>
      </section>
    </div>
  );
}
