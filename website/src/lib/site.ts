export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a /public asset path with the deployment base path (GitHub Pages). */
export const asset = (p: string) => `${BASE_PATH}${p}`;

export const MODEL_URL = asset("/models/argo_q4.glb");

export const SITE = {
  name: "ARGO-Q4",
  tagline: "Hydraulic quadruped field robot with a 5-DOF manipulator",
  repo: "https://github.com/jaineil32624/robotics-showcase",
  author: "Jaineil Rana",
  github: "https://github.com/jaineil32624",
  linkedin: "https://www.linkedin.com/in/jaineil-rana-89005736a",
};

export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/viewer/", label: "3D Viewer" },
  { href: "/specs/", label: "Engineering Specs" },
  { href: "/animations/", label: "Animations" },
  { href: "/build/", label: "Build Process" },
  { href: "/about/", label: "About" },
];
