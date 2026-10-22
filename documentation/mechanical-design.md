# Mechanical design decisions

ARGO-Q4 is a 54 kg (sum of parts) quadruped with a top-mounted 5-DOF arm. All dimensions below come from
`blender/argo/motion.py`, which is the single source of truth for the model, the animations and the website.

## 1. Overall layout

| Decision | Reason |
|---|---|
| Body as a two-rail aluminium spine with two bulkheads at x = ±0.27 m | The bulkheads carry the four hip-abduction motors and take leg loads directly into the frame; everything else is a bolt-on module. |
| Hip pivots at (±0.40, ±0.12) m, 0.10 m outboard offset to the hip-pitch joint | Gives a 0.44 m stance width — wide enough for lateral stability with a 5 kg payload at full arm reach. |
| Abduction motors *inside* the body envelope, exposed at the corners ("hip bays") | Keeps the side panels short (±0.27 m) so thighs never collide with the shell, and shows the actuators. |
| Arm turret at the body centre, cargo deck behind it | The arm can reach the ground/stand in front **and** fold back over the deck — the pick-and-stow task drives this. |
| Sensor head between the front hips, above the abduction motors | Clear forward field of view and protection for the stereo pair. |

## 2. Leg kinematics

- 3 DOF per leg: abduction (roll about body X), hip pitch, knee — knees fold **rearward** on all four legs.
- Thigh 320 mm, shin 340 mm, foot sphere Ø70 mm, nominal body height 620 mm.
- Standing joint angles: hip +32.2°, knee −62.3°. Parked: knee ≈ −170° with the skid plate 39 mm above ground.
- Used ranges (from all 2 490 frames): abduction ±30°, hip +15°…+86°, knee −170°…−58°.

The IK is analytic: the abduction angle is solved first so the foot lies in the leg plane offset by `HIP_W`,
then a two-link planar solve picks the knee-behind branch. `tests/test_motion.py` checks FK(IK(x)) = x to 1 µm.

## 3. Actuators

| Joint | Drive | Why |
|---|---|---|
| Hip abduction ×4 | Frameless torque motor + cycloidal 9:1 | Short, stiff, back-drivable; lateral loads are moderate. |
| Hip pitch ×4 | Strain-wave 50:1 servo on the hip yoke cheek | High torque density, near-zero backlash for foot placement. |
| Knee ×4 | **Double-acting hydraulic cylinder** acting on a heel lever | Knees carry the largest torques during stand-up and landing; hydraulics give force density and natural compliance. |
| Turret / shoulder / elbow | Crossed-roller slew ring + strain-wave servos | Precise, compact. The elbow is offset 55 mm so the forearm folds *beside* the upper arm when stowed. |
| Wrist pitch / roll | Compact servo / roll drive with slip ring | Continuous roll for tool alignment. |
| Gripper | Single motor, left/right-hand lead screw | Parallel jaws, self-centring, holds position unpowered. |

## 4. Hydraulic knee sizing

A cylinder's pin-to-pin length must stay within what one telescoping barrel/rod pair can physically do:

```
d_max ≤ 2·d_min − clearance
```

`engineering/knee_actuator_sizing.py` grid-searches the cylinder clevis **A** (thigh frame) and rod clevis **B**
(on a heel lever above the knee, shin frame) over the knee range actually used by the choreography and keeps
the placement with the most stroke:

| Result | Value |
|---|---|
| A (thigh frame, x/z) | (0.11, 0.00) m — in front of the hip, like a quadriceps |
| B (shin frame, x/z) | (0.07, 0.12) m |
| Pin length | 264 → 471 mm (207 mm stroke) |
| Barrel / rod (auto-sized by the build) | 258 mm / 244 mm |

The cylinder sits 48 mm outboard of the thigh so it clears the hip-pitch servo through the full swing.

## 5. Accessory drivetrain

Module-4 spur gears, 20 → 14 (idler) → 28 teeth; centre distances are the sum of pitch radii. The animation
enforces the kinematic constraint `ω_idler = −ω_drive·20/14`, `ω_output = ω_drive·20/28` and a half-tooth phase
offset on the idler so the teeth mesh visually.

## 6. Mass budget (design estimate)

| Subsystem | Mass |
|---|---|
| Actuators | 13.7 kg |
| Structure | 7.6 kg |
| Legs | 7.4 kg |
| Power | 6.9 kg |
| Hydraulics | 6.7 kg |
| Manipulator | 3.9 kg |
| Shell | 2.5 kg |
| Drivetrain | 2.1 kg |
| Sensors / cooling / electronics | 3.7 kg |
| **Total** | **54.5 kg** |

Per-part values are in [`engineering/bill_of_materials.csv`](../engineering/bill_of_materials.csv).
