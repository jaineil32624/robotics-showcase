# Animation pipeline

```
argo/motion.py  ──(pose per frame)──▶  build_robot.py bake loop  ──▶  F-curves  ──▶  glTF (1 baked timeline)
```

## 1. Poses are functions of time

Each clip is a Python function `clip_x(t) -> pose`. A pose contains:

| Field | Meaning |
|---|---|
| `root` | x, y, yaw of the whole robot (walking travel) |
| `body` | bx, by, z, roll, pitch relative to the root |
| `feet` / `legs` | foot targets (solved by IK) or explicit joint angles |
| `arm`, `grip` | turret/shoulder/elbow/wrist angles, gripper opening 0…1 |
| `omega` | rev/s for lidar, fan and pump (integrated into angles) |
| `power`, `explode`, `props`, `events` | emission level, exploded factor, prop visibility, grasp/release flags |

Because clips are code, they can be validated without Blender (`tests/test_motion.py`).

## 2. Motion primitives

- **Minimum-jerk tracks** (`Track`, `ArmTrack`) — quintic `10s³ − 15s⁴ + 6s⁵` between keys: zero velocity and
  acceleration at each key, like a servo point-to-point move.
- **Leg IK** with planted feet: postures such as stand-up, weight shift and body 6-DOF demos move the body
  while feet targets stay fixed in the world.
- **Arm IK** with an approach angle (`π/2` = gripper pointing down) and the 55 mm elbow offset compensated in
  the turret yaw.
- **Trot planner** (`TrotGait`) — body velocity profile → integrated body x(t); each foot is planted during
  stance and swings on a min-jerk arc to a foothold placed under the hip at the middle of its next stance.
  Lift height scales with step length, so the robot does not "march in place" when stopped.
- **Second-order responses** — payload sag is a spring-damper (`ω = 11 rad/s, ζ = 0.32`) driven by the load
  profile; startup ends with a damped settle.

## 3. The ten sequences

| # | Clip | Frames | Highlights |
|---|---|---|---|
| 1 | Power-on | 1–120 | boot flicker, fan/pump/lidar spin-up, servo self-test twitch |
| 2 | Mechanical startup | 121–330 | abduction calibration, stand-up, arm unfolds over the top |
| 3 | Idle | 331–450 | seamless 4 s loop (all channels periodic) |
| 4 | Joint demonstration | 451–870 | weight shift, FL leg lift, every joint isolated, body 6-DOF |
| 5 | Walking cycle | 871–1110 | trot to 0.42 m/s, acceleration lean, inertial arm lag |
| 6 | Arm manipulation | 1111–1350 | IK through 5 workspace waypoints, wrist roll, gripper |
| 7 | Object interaction | 1351–1710 | pick crate, payload sag, stow on cargo deck, drop/settle |
| 8 | Full operating mode | 1711–2070 | 0.5 m/s patrol, scanning arm, 2× lidar |
| 9 | Shutdown | 2071–2250 | stow, park, spin-down, power fade |
| 10 | Exploded view | 2251–2490 | parts separate along assembly vectors and rebuild |

## 4. Baking

For every frame the bake loop:

1. evaluates the pose and writes joint transforms (empties), spinning parts and `Power_Level`;
2. updates the depsgraph, then **aims the hydraulic cylinders**: barrel and rod each point at the other's
   clevis (`to_track_quat('Z','Y')` in the parent frame);
3. handles the crate: fixed on the stand → attached to the gripper at the grasp event (offset captured from
   world matrices) → attached to the body at release, falling the last millimetres under gravity with a
   restitution of 0.3;
4. applies exploded offsets, converting each part's body-frame vector into its parent frame;
5. records every channel. Constant channels are dropped; the rest are written directly as LINEAR F-curves
   (`keyframe_points.foreach_set`) — far faster than `keyframe_insert`.

The bake runs **twice**: pass 1 measures the knee pin-to-pin distance over all frames, the cylinder meshes are
then generated at the right length, and pass 2 bakes the final animation.
