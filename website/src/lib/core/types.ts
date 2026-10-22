/**
 * Shared data contracts between the Blender exporter, the website and the
 * mobile viewer. `parts.json` and `clips.json` are written by
 * `blender/build_robot.py` next to `argo_q4.glb`.
 */

export type PartCategory =
  | "frame"
  | "shell"
  | "power"
  | "hydraulics"
  | "drivetrain"
  | "actuator"
  | "leg"
  | "arm"
  | "sensor"
  | "electronics"
  | "cooling"
  | "prop";

export interface PartInfo {
  title: string;
  category: PartCategory;
  group: string;
  description: string;
  specs: Record<string, string>;
  mass_kg: number;
}

export type PartCatalogue = Record<string, PartInfo>;

export interface ClipInfo {
  id: string;
  label: string;
  desc: string;
  start: number; // first frame (1-based, inclusive)
  end: number; // last frame (inclusive)
  frames: number;
  loop: boolean;
  dur: number; // seconds
}

export interface ClipTable {
  fps: number;
  frame_start: number;
  frame_end: number;
  clips: ClipInfo[];
}

export const CATEGORY_META: Record<PartCategory, { label: string; color: string }> = {
  frame: { label: "Structure", color: "#9aa4b2" },
  shell: { label: "Shell", color: "#e8eaee" },
  power: { label: "Power", color: "#38d6ff" },
  hydraulics: { label: "Hydraulics", color: "#ff5a1f" },
  drivetrain: { label: "Drivetrain", color: "#d9a441" },
  actuator: { label: "Actuators", color: "#ff8a3d" },
  leg: { label: "Legs", color: "#7d8796" },
  arm: { label: "Manipulator", color: "#c3cad4" },
  sensor: { label: "Sensors", color: "#5ee0c0" },
  electronics: { label: "Electronics", color: "#7cd97c" },
  cooling: { label: "Cooling", color: "#8fb3ff" },
  prop: { label: "Props", color: "#bfa86a" },
};
