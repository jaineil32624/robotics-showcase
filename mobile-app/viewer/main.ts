/**
 * ARGO-Q4 mobile renderer.
 *
 * Runs inside the app's WebView from file:///android_asset/viewer/. It reuses
 * the website's RobotController so playback and inspection behave identically,
 * and talks to the React Native shell through a tiny message protocol:
 *
 *   native -> web : window.argo.<command>(...)            (injectJavaScript)
 *   web -> native : ReactNativeWebView.postMessage(JSON)  ({ type, ... })
 *
 * The GLB is embedded as base64 in model.js so the app works fully offline.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RobotController } from "../../website/src/lib/core/RobotController";
import type { ClipTable, PartCatalogue } from "../../website/src/lib/core/types";
import clips from "../../assets/model/clips.json";
import parts from "../../assets/model/parts.json";

declare global {
  interface Window {
    ARGO_MODEL_B64?: string;
    ReactNativeWebView?: { postMessage: (s: string) => void };
    argo: Record<string, (...a: never[]) => unknown>;
  }
}

type View = "iso" | "front" | "side" | "top" | "rear";
const VIEWS: Record<View, [THREE.Vector3Tuple, THREE.Vector3Tuple]> = {
  iso: [[2.3, 1.35, 2.2], [0.05, 0.42, 0]],
  front: [[3.0, 0.8, 0], [0.1, 0.42, 0]],
  side: [[0.1, 0.7, 3.1], [0.05, 0.4, 0]],
  top: [[0.05, 3.5, 0.01], [0.05, 0.4, 0]],
  rear: [[-2.6, 1.2, -1.5], [0, 0.42, 0]],
};

const post = (msg: object) => {
  const s = JSON.stringify(msg);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else console.log("[argo]", s);
};

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// ---------------------------------------------------------------- renderer
let quality = 1; // 0 low, 1 medium, 2 high
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#07090c");
scene.fog = new THREE.Fog("#07090c", 7, 18);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 60);
camera.position.set(...VIEWS.iso[0]);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...VIEWS.iso[1]);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.45;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.autoRotateSpeed = 0.7;

scene.add(new THREE.HemisphereLight("#b9c6d6", "#0b0d10", 0.5));
const sun = new THREE.DirectionalLight("#ffffff", 2.3);
sun.position.set(3.2, 5, 2.4);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5 });
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight("#9ccfff", 1.2);
rim.position.set(-4, 2.2, -3);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(20, 200, "#26313d", "#141a21");
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.7;
grid.position.y = 0.0005;
scene.add(grid);

function applyQuality(q: number) {
  quality = q;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, [1, 1.5, 2][q]));
  renderer.shadowMap.enabled = q > 0;
  sun.castShadow = q > 0;
  sun.shadow.mapSize.setScalar(q > 1 ? 2048 : 1024);
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  resize();
}

/** Portrait phones need the camera further back so the whole robot fits. */
const fitScale = () => (window.innerWidth / Math.max(window.innerHeight, 1) < 0.9 ? 1.85 : 1);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

// ---------------------------------------------------------------- state
let ctrl: RobotController | null = null;
let follow = true;
let showFps = false;
let viewAnim: { from: THREE.Vector3; to: THREE.Vector3; tf: THREE.Vector3; tt: THREE.Vector3; t: number } | null = null;
const lastRoot = new THREE.Vector3();
const tmp = new THREE.Vector3();

function goTo(pos: THREE.Vector3, target: THREE.Vector3) {
  viewAnim = { from: camera.position.clone(), to: pos, tf: controls.target.clone(), tt: target, t: 0 };
}

function rootPos() {
  return ctrl?.scene.getObjectByName("ARGO_Q4")?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
}

// ---------------------------------------------------------------- picking (tap)
const ray = new THREE.Raycaster();
let down: { x: number; y: number; t: number } | null = null;
renderer.domElement.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
});
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!down || !ctrl) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 350;
  down = null;
  if (moved > 8 || !quick) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(ctrl.scene, true).find((h) => h.object.visible && ctrl!.ownerOf(h.object));
  const name = hit ? ctrl.ownerOf(hit.object) : null;
  ctrl.setSelected(name);
  post({ type: "select", name });
});

// ---------------------------------------------------------------- command API
window.argo = {
  setClip: (id: string) => ctrl?.setClip(id),
  play: () => ctrl?.play(),
  pause: () => ctrl?.pause(),
  toggle: () => ctrl?.toggle(),
  seek: (f: number) => {
    ctrl?.pause();
    ctrl?.seek(f);
  },
  setSpeed: (s: number) => ctrl?.setSpeed(s),
  setLoop: (on: boolean) => {
    if (ctrl) ctrl.loopOverride = on ? true : null;
  },
  setXray: (on: boolean) => ctrl?.setXray(on),
  setWireframe: (on: boolean) => ctrl?.setWireframe(on),
  setInPlace: (on: boolean) => {
    if (ctrl) ctrl.inPlace = on;
  },
  setAutoRotate: (on: boolean) => {
    controls.autoRotate = on;
  },
  setFollow: (on: boolean) => {
    follow = on;
  },
  setQuality: (q: number) => applyQuality(q),
  setShowFps: (on: boolean) => {
    showFps = on;
  },
  setExplode: (a: number) => ctrl?.setExplode(a),
  setIsolate: (on: boolean) => ctrl?.setIsolate(on),
  select: (name: string | null) => {
    if (!ctrl) return;
    ctrl.setSelected(name);
    if (name) {
      const c = ctrl.partCenter(name);
      const size = Math.max(ctrl.partSize(name), 0.18);
      const dir = camera.position.clone().sub(controls.target).normalize();
      goTo(c.clone().add(dir.multiplyScalar(size * 2.6 + 0.3)), c);
    }
  },
  view: (v: View) => {
    const [p, t] = VIEWS[v] ?? VIEWS.iso;
    const off = rootPos();
    const target = new THREE.Vector3(...t);
    const pos = new THREE.Vector3(...p).sub(target).multiplyScalar(fitScale()).add(target);
    goTo(pos.add(off), target.add(off));
  },
} as unknown as Window["argo"];

// ---------------------------------------------------------------- boot
async function boot() {
  applyQuality(quality);
  camera.position.sub(controls.target).multiplyScalar(fitScale()).add(controls.target);
  const bar = document.getElementById("bar");
  bar?.style.setProperty("--p", "40%");
  const b64 = window.ARGO_MODEL_B64;
  if (!b64) throw new Error("Embedded model missing (model.js)");
  const gltf = await new GLTFLoader().parseAsync(b64ToBuffer(b64), "");
  bar?.style.setProperty("--p", "90%");
  scene.add(gltf.scene);
  ctrl = new RobotController(gltf.scene, gltf.animations, parts as unknown as PartCatalogue, clips as ClipTable);
  ctrl.setClip("idle");
  lastRoot.copy(rootPos());
  document.getElementById("boot")?.remove();
  post({ type: "ready", parts: Object.keys(parts).length, triangles: ctrl.triangles });
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let acc = 0;
let frames = 0;
let fps = 60;
let stateTimer = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (ctrl) {
    ctrl.update(dt);
    const r = rootPos();
    tmp.copy(r).sub(lastRoot);
    if (follow && !viewAnim && tmp.lengthSq() > 0 && tmp.lengthSq() < 1) {
      camera.position.add(tmp);
      controls.target.add(tmp);
    }
    lastRoot.copy(r);
  }
  if (viewAnim) {
    viewAnim.t = Math.min(viewAnim.t + dt / 0.85, 1);
    const k = 1 - Math.pow(1 - viewAnim.t, 3);
    camera.position.lerpVectors(viewAnim.from, viewAnim.to, k);
    controls.target.lerpVectors(viewAnim.tf, viewAnim.tt, k);
    if (viewAnim.t >= 1) viewAnim = null;
  }
  controls.update();
  renderer.render(scene, camera);

  acc += dt;
  frames += 1;
  if (acc >= 0.5) {
    fps = frames / acc;
    acc = 0;
    frames = 0;
  }
  stateTimer += dt;
  if (ctrl && stateTimer > 0.1) {
    stateTimer = 0;
    const s = ctrl.state;
    post({ type: "state", ...s, power: ctrl.power, fps: showFps ? Math.round(fps) : undefined });
  }
});

boot().catch((err) => {
  const el = document.getElementById("boot");
  if (el) el.textContent = `Failed to load model: ${String(err)}`;
  post({ type: "error", message: String(err) });
});
