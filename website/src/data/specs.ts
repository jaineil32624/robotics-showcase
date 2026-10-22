/**
 * Engineering specification sheet for ARGO-Q4.
 * Geometric values mirror the constants in blender/argo/motion.py; performance
 * figures are design targets for this concept prototype.
 */

export interface SpecRow {
  k: string;
  v: string;
  note?: string;
}

export interface SpecGroup {
  id: string;
  title: string;
  rows: SpecRow[];
}

export const HEADLINE = [
  { v: "18", u: "DOF", k: "Actuated joints" },
  { v: "0.50", u: "m/s", k: "Trot speed" },
  { v: "0.93", u: "m", k: "Arm reach" },
  { v: "5", u: "kg", k: "Arm payload" },
  { v: "1.15", u: "kWh", k: "Battery" },
  { v: "21", u: "MPa", k: "Hydraulic pressure" },
];

export const SPEC_GROUPS: SpecGroup[] = [
  {
    id: "dimensions",
    title: "Dimensions",
    rows: [
      { k: "Length (head to fan grille)", v: "1.10 m" },
      { k: "Width (hip yokes)", v: "0.61 m" },
      { k: "Stance width (foot centres)", v: "0.44 m" },
      { k: "Height, standing (lidar top)", v: "0.81 m" },
      { k: "Height, parked", v: "0.39 m" },
      { k: "Nominal body height", v: "0.62 m" },
      { k: "Ground clearance, standing", v: "0.55 m" },
    ],
  },
  {
    id: "mobility",
    title: "Locomotion",
    rows: [
      { k: "Leg configuration", v: "3-DOF ×4, knees rearward" },
      { k: "Thigh / shin length", v: "320 mm / 340 mm" },
      { k: "Gait", v: "Diagonal trot, Raibert foothold placement" },
      { k: "Gait period / duty factor", v: "0.9 s / 0.60" },
      { k: "Step height", v: "75 mm" },
      { k: "Max demonstrated speed", v: "0.50 m/s" },
      { k: "Foot slip in stance (simulated)", v: "< 0.5 mm / frame", note: "Verified by unit test" },
    ],
  },
  {
    id: "manipulation",
    title: "Manipulation",
    rows: [
      { k: "Arm DOF", v: "5 + parallel gripper" },
      { k: "Upper arm / forearm", v: "400 mm / 360 mm" },
      { k: "Wrist to grasp centre", v: "170 mm" },
      { k: "Turret slew range", v: "± 270°" },
      { k: "Wrist roll", v: "Continuous (slip ring)" },
      { k: "Gripper stroke", v: "24 – 144 mm" },
      { k: "Payload at full reach", v: "5 kg" },
    ],
  },
  {
    id: "power",
    title: "Power",
    rows: [
      { k: "Battery", v: "13S5P Li-NMC 21700, 63 cells" },
      { k: "Nominal voltage / capacity", v: "48.1 V / 24 Ah" },
      { k: "Energy", v: "1.15 kWh" },
      { k: "Average draw (trot)", v: "≈ 480 W" },
      { k: "Estimated runtime", v: "≈ 2.4 h mixed duty" },
      { k: "Regenerative buffer", v: "2 × 165 F supercapacitor" },
    ],
  },
  {
    id: "hydraulics",
    title: "Hydraulics",
    rows: [
      { k: "Power unit", v: "1.2 kW BLDC + axial-piston pump" },
      { k: "Max system pressure", v: "21 MPa" },
      { k: "Flow", v: "6.5 L/min" },
      { k: "Knee actuators", v: "4 × double-acting, Ø32 / Ø16 mm" },
      { k: "Knee actuator stroke", v: "≈ 207 mm", note: "Sized automatically from the baked animation" },
      { k: "Fluid", v: "ISO VG 32, 0.4 L reservoir" },
    ],
  },
  {
    id: "sensing",
    title: "Perception & Compute",
    rows: [
      { k: "Lidar", v: "32-channel, 120 m, 640 k pts/s" },
      { k: "Depth cameras", v: "Global-shutter stereo, 120 mm baseline" },
      { k: "Foot contact", v: "6-axis force/torque per foot" },
      { k: "Compute", v: "8-core Cortex-A78AE + 100 TOPS accelerator" },
      { k: "Control loop", v: "1 kHz whole-body controller" },
      { k: "Field bus", v: "EtherCAT, 18 nodes" },
    ],
  },
];

export const JOINTS = [
  { joint: "Hip abduction (×4)", axis: "Body X (roll)", range: "−30° … +30°", drive: "Cycloidal 9:1 torque motor" },
  { joint: "Hip pitch (×4)", axis: "Leg Y (pitch)", range: "+15° … +86°", drive: "Strain-wave 50:1 servo" },
  { joint: "Knee (×4)", axis: "Leg Y (pitch)", range: "−170° … −58°", drive: "Hydraulic cylinder via heel lever" },
  { joint: "Turret slew", axis: "Body Z (yaw)", range: "−80° … +170° used", drive: "Crossed-roller + servo" },
  { joint: "Shoulder", axis: "Turret Y", range: "−180° … −8°", drive: "Strain-wave 100:1" },
  { joint: "Elbow", axis: "Arm Y", range: "+41° … +180°", drive: "Strain-wave 80:1" },
  { joint: "Wrist pitch", axis: "Forearm Y", range: "−71° … +130°", drive: "Compact servo" },
  { joint: "Wrist roll", axis: "Wrist X", range: "Continuous", drive: "Servo + slip ring" },
  { joint: "Gripper", axis: "Prismatic Y", range: "12 – 72 mm per finger", drive: "Twin-lead screw" },
];
