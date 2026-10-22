# Blender workflow

Requirements: **Blender 4.2 LTS or newer** (developed on 5.2 LTS). No add-ons are needed.

## Rebuild everything

Interactive:

1. Open Blender → **Scripting** workspace → *Text › Open* → `blender/build_robot.py`.
2. Press **Run Script**. The scene is cleared and rebuilt (≈ 5 s): 69 components, rig of empties, 2 490 baked
   frames, stage, lights and 8 cameras. Exports land in `export/` next to the repo.

Headless (CI / batch):

```bash
blender --background --python blender/build_robot.py -- --out assets/model
```

From the Python console you can call the stages separately:

```python
build(bake=True, stage=True)      # model + animation + stage
export_all("assets/model")        # argo_q4.glb, parts.json, clips.json, argo_q4.blend
render_stills("renders")          # the 10 PNG stills listed in SHOTS
render_videos("videos")           # one H.264 MP4 per clip, marker-bound cameras
```

## Scene structure

```
ARGO_Q4 (root, carries walking travel)
├── Body (bob / pitch / roll)
│   ├── Chassis_Frame, Skid_Plate, Top_Cover, Side_Panel_L/R, …   static modules
│   ├── Gear_Drive / Gear_Idler / Gear_Output, Cooling_Fan_Rotor, Lidar_Rotor   spinning parts
│   ├── Hip_Abd_Motor_XX → J_HipAbd_XX → Hip_Yoke_XX, Hip_Pitch_Servo_XX
│   │                              └── J_HipPitch_XX → Thigh_XX, Knee_Bearing_XX, Knee_Cylinder_XX
│   │                                               └── J_Knee_XX → Shin_XX, Foot_XX, Knee_Rod_XX
│   └── J_Turret → J_Shoulder → J_Elbow → J_WristPitch → J_WristRoll → Gripper_Palm, J_Finger_L/R
├── Power_Level (empty; scale.x = bus power 0…1, drives emission)
Props: Work_Stand, Sample_Crate        Stage: cyclorama, 4 area lights, cameras
```

Joints are **empties**; meshes are rigid children. This keeps the hierarchy exportable to glTF as plain node
animation (no armature/skinning) and makes every component individually selectable.

Collections: `ARGO_Q4` (exported), `Props` (exported), `Stage` (render only).

## Cameras & cinematics

| Camera | Use |
|---|---|
| Cam_Hero / Cam_Hero_Left | ¾ beauty angles |
| Cam_Side | Profile, follows the root while walking |
| Cam_Orbit | On a rig that turns 3× over the timeline |
| Cam_Head, Cam_Knee | Detail close-ups with depth of field |
| Cam_Top, Cam_Wide | Internals and exploded view |

Timeline markers at every clip start are bound to a camera, so playing or rendering the whole timeline cuts
between angles automatically. All cameras use a *Track To* constraint on `Cam_Target` (child of `Body`).

## Materials

17 Principled BSDF materials using factors only (no textures) so the glTF matches Blender 1:1.
`Glow_Cyan` and `Glow_Amber` have a driver: `Emission Strength = Power_Level.scale.x × base`.

## Rendering

EEVEE, AgX view transform, 64 TAA samples for stills / 24 for video. On an average desktop GPU a 1080p still
takes < 1 s and the complete 83 s film ≈ 7 min at 720p.
