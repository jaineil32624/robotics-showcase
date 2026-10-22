# Source structure

```
robotics-showcase/
├── blender/
│   ├── argo/motion.py          kinematics, gait, choreography (pure Python — single source of truth)
│   ├── build_robot.py          bmesh modelling, bake, stage/cameras, export, render_stills/videos
│   ├── tests/test_motion.py    IK round-trip, planted-feet, joint-limit and reach tests
│   └── argo_q4.blend           saved Blender scene
├── assets/model/               argo_q4.glb · parts.json · clips.json (build outputs, committed)
├── engineering/
│   ├── knee_actuator_sizing.py clevis placement study for the hydraulic knees
│   └── bill_of_materials.csv   generated from parts.json
├── website/                    Next.js 15 App Router, static export
│   ├── src/lib/core/           RobotController.ts + types.ts  (shared with mobile)
│   ├── src/components/three/   Scene, Robot, RobotContext (R3F)
│   ├── src/components/ui/      nav, footer, playback bar, parts browser/inspector
│   ├── src/app/                / · /viewer · /specs · /animations · /build · /about
│   └── scripts/                sync-assets.mjs, capture.mjs (CI screenshots)
├── mobile-app/                 Expo SDK 53 / React Native
│   ├── App.tsx                 native shell: top bar, tools, dock, sheets, back handling
│   ├── src/components/         Panels (animations, parts, specs, settings, about), Scrubber
│   ├── viewer/                 WebGL renderer entry (imports website/src/lib/core)
│   ├── scripts/build-viewer.mjs  esbuild bundle + base64 model → assets/viewer/
│   └── plugins/withViewerAssets.js  copies the viewer into android/app/src/main/assets
├── renders/ · videos/ · screenshots/
└── .github/workflows/ci.yml
```

## Dependency direction

```
motion.py → build_robot.py → assets/model → RobotController.ts → { website, mobile viewer → mobile shell }
```

Nothing downstream is edited by hand: change a dimension in `motion.py`, rerun the build, and the model, the
animation, the hydraulic sizing, the website and the app all follow.
