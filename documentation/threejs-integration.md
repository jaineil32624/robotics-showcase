# Three.js integration guide

The runtime lives in [`website/src/lib/core/RobotController.ts`](../website/src/lib/core/RobotController.ts) and has
**no React dependency**, so the website (React Three Fiber) and the Android WebView renderer (plain three.js)
share it.

## Loading

```ts
const gltf = await new GLTFLoader().loadAsync("/models/argo_q4.glb");
scene.add(gltf.scene);
const robot = new RobotController(gltf.scene, gltf.animations, parts, clips);
robot.setClip("walk");
renderer.setAnimationLoop(() => { robot.update(clock.getDelta()); renderer.render(scene, camera); });
```

## How clips are played

The exporter writes one animation per animated node; `RobotController.mergeClips` combines them into one
timeline clip. Instead of `AnimationUtils.subclip` (which drops tracks that have no keys inside a window
once duplicate keys are optimised away), the controller drives the action time directly:

```ts
action.time = keyOffset + (clip.start - frame_start) / fps + localTime;
mixer.update(0);
```

`keyOffset` is the time of the first key (Blender stamps frame *f* at *f / fps*). Looping, speed and
end-of-clip handling are done in `update(dt)`.

## Power-driven emission

After each update the controller reads `Power_Level.scale.x` and sets
`emissiveIntensity = base × power` on its own copies of the glow materials, so the power-on and shutdown
sequences fade the lights exactly as in Blender.

## Picking & inspection

- `ownerOf(object)` walks up the hierarchy to the nearest node listed in `parts.json`
  (multi-material meshes are split into child primitives by GLTFLoader).
- Each part receives **cloned materials** at load time, so `setHovered`, `setSelected` and `setIsolate`
  can tint or fade a single component without affecting others.
- `partCenter(name)` / `partSize(name)` drive camera focus.
- `setXray(true)` hides every `shell` part; `setWireframe`, `setExplode(0…1)` (scrubs the exploded clip),
  and `inPlace` (zeroes the root) round out the inspection tools.

## React Three Fiber wiring

```tsx
<Canvas shadows dpr={[1, 2]}>
  <Suspense fallback={<Loader/>}><Robot clip={clip} interactive /></Suspense>
  <OrbitControls makeDefault enableDamping />
  <CameraRig />            {/* presets, focus, walk-follow */}
  <PerformanceMonitor onDecline={…}/> <AdaptiveDpr/>
</Canvas>
```

`Robot` creates the controller in `useMemo`, publishes it through `RobotContext`, advances it in `useFrame`
and maps R3F pointer events to hover/selection (clicks with > 4 px drag are ignored as orbit gestures).
UI components subscribe with `usePlayback()`.

## Performance

- 86 k triangles, ~250 draw calls; factor-only materials (no texture uploads).
- Environment lighting from drei `<Lightformer>`s — no HDR download.
- `PerformanceMonitor` lowers shadow-map size and DPR on slow devices; the Canvas is client-only
  (`next/dynamic`, `ssr: false`) so pages stay statically exportable.
