/**
 * RobotController - framework-agnostic runtime for the ARGO-Q4 asset.
 *
 * Used by both the Next.js / React-Three-Fiber website and the WebView
 * renderer bundled inside the Android app, so animation playback, part
 * picking and inspection behave identically on every platform.
 *
 * The GLB contains ONE baked animation covering the whole Blender timeline.
 * Instead of slicing it into sub-clips (which breaks on channels whose
 * duplicate keys were optimised away) we drive `action.time` directly inside
 * each clip's frame window. The mixer then interpolates every channel
 * correctly, regardless of key density.
 */
import * as THREE from "three";
import type { ClipInfo, ClipTable, PartCatalogue } from "./types";

const HOVER = new THREE.Color("#ff7a2e");
const SELECT = new THREE.Color("#ff5a1f");
/** Emissive colours for the status-light materials; intensity follows the Power_Level node. */
const GLOW: Record<string, { color: string; intensity: number }> = {
  Glow_Cyan: { color: "#2ee0ff", intensity: 3.2 },
  Glow_Amber: { color: "#ff7a1a", intensity: 2.6 },
};

interface MatRecord {
  mat: THREE.MeshStandardMaterial;
  emissive: THREE.Color;
  emissiveIntensity: number;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  glow: boolean;
}

export interface ControllerState {
  clipId: string;
  playing: boolean;
  time: number; // seconds into the current clip
  duration: number;
  speed: number;
  loop: boolean;
  label: string;
}

export type Listener = (s: ControllerState) => void;

export class RobotController {
  readonly scene: THREE.Object3D;
  readonly parts: PartCatalogue;
  readonly clips: ClipTable;
  readonly partNodes = new Map<string, THREE.Object3D>();
  readonly triangles: number;

  private mixer: THREE.AnimationMixer;
  private action: THREE.AnimationAction | null = null;
  /** Time (s) of the first baked key, i.e. of frame `clips.frame_start`. */
  private keyOffset = 0;
  private mats = new Map<string, MatRecord[]>();
  private glow: MatRecord[] = [];
  private rootNode: THREE.Object3D | null;
  private powerNode: THREE.Object3D | null;
  private listeners = new Set<Listener>();
  private hovered: string | null = null;
  private selected: string | null = null;
  private isolate = false;

  current: ClipInfo;
  time = 0;
  playing = true;
  speed = 1;
  loopOverride: boolean | null = null;
  inPlace = false;
  xray = false;
  power = 1;

  constructor(scene: THREE.Object3D, animations: THREE.AnimationClip[], parts: PartCatalogue, clips: ClipTable) {
    this.scene = scene;
    this.parts = parts;
    this.clips = clips;
    this.mixer = new THREE.AnimationMixer(scene);
    const clip = RobotController.mergeClips(animations);
    if (clip) {
      // Blender's exporter stamps frame f at f / fps, so the first key may not be at t = 0.
      this.keyOffset = Math.min(...clip.tracks.map((t) => t.times[0] ?? 0));
      this.action = this.mixer.clipAction(clip);
      this.action.setLoop(THREE.LoopRepeat, Infinity);
      this.action.play();
    }
    this.rootNode = scene.getObjectByName("ARGO_Q4") ?? null;
    this.powerNode = scene.getObjectByName("Power_Level") ?? null;

    let tris = 0;
    scene.traverse((o) => {
      if (parts[o.name]) this.partNodes.set(o.name, o);
    });
    // Give every part its own material instances so it can be highlighted alone.
    for (const [name, node] of this.partNodes) {
      const recs: MatRecord[] = [];
      node.traverse((o) => {
        if (o !== node && this.partNodes.has(o.name)) return;
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (this.ownerOf(mesh) !== name) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const g = mesh.geometry;
        tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = list.map((m) => {
          const c = (m as THREE.MeshStandardMaterial).clone();
          c.name = m.name;
          const g = GLOW[m.name];
          const glow = !!g;
          if (g) c.emissive.set(g.color);
          const rec: MatRecord = {
            mat: c,
            emissive: c.emissive.clone(),
            emissiveIntensity: g ? g.intensity : c.emissiveIntensity,
            opacity: c.opacity,
            transparent: c.transparent,
            depthWrite: c.depthWrite,
            glow,
          };
          if (glow) {
            c.toneMapped = false;
            this.glow.push(rec);
          }
          recs.push(rec);
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      });
      this.mats.set(name, recs);
    }
    this.triangles = Math.round(tris);
    this.current = clips.clips.find((c) => c.id === "idle") ?? clips.clips[0];
    this.apply();
  }

  /** Combine several glTF animations into one clip (exporter-mode agnostic). */
  static mergeClips(anims: THREE.AnimationClip[]): THREE.AnimationClip | null {
    if (!anims.length) return null;
    if (anims.length === 1) return anims[0];
    const tracks = anims.flatMap((a) => a.tracks);
    return new THREE.AnimationClip("ARGO_Timeline", -1, tracks);
  }

  // ------------------------------------------------------------------ state
  get duration() {
    return Math.max((this.current.frames - 1) / this.clips.fps, 1 / this.clips.fps);
  }

  get loop() {
    return this.loopOverride ?? this.current.loop;
  }

  get state(): ControllerState {
    return {
      clipId: this.current.id,
      playing: this.playing,
      time: this.time,
      duration: this.duration,
      speed: this.speed,
      loop: this.loop,
      label: this.current.label,
    };
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const s = this.state;
    this.listeners.forEach((l) => l(s));
  }

  // --------------------------------------------------------------- playback
  setClip(id: string, opts: { play?: boolean; time?: number } = {}) {
    const c = this.clips.clips.find((x) => x.id === id);
    if (!c) return;
    this.current = c;
    this.time = opts.time ?? 0;
    this.playing = opts.play ?? true;
    this.apply();
    this.emit();
  }

  play() {
    if (!this.loop && this.time >= this.duration - 1e-3) this.time = 0;
    this.playing = true;
    this.emit();
  }

  pause() {
    this.playing = false;
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(fraction: number) {
    this.time = THREE.MathUtils.clamp(fraction, 0, 1) * this.duration;
    this.apply();
    this.emit();
  }

  setSpeed(s: number) {
    this.speed = s;
    this.emit();
  }

  /** Drive the exploded-view sequence directly from a 0..1 slider. */
  setExplode(amount: number) {
    const c = this.clips.clips.find((x) => x.id === "exploded");
    if (!c) return;
    if (this.current.id !== "exploded") this.current = c;
    this.playing = false;
    // explode-out section of the clip spans 0.3 s -> 2.8 s
    this.time = 0.3 + THREE.MathUtils.clamp(amount, 0, 1) * 2.5;
    this.apply();
    this.emit();
  }

  /** Advance playback; call once per rendered frame. Returns true if the pose changed. */
  update(dt: number): boolean {
    if (!this.playing) return false;
    const d = this.duration;
    this.time += dt * this.speed;
    let ended = false;
    if (this.time >= d) {
      if (this.loop) this.time %= d;
      else {
        this.time = d;
        this.playing = false;
        ended = true;
      }
    }
    this.apply();
    if (ended) this.emit();
    return true;
  }

  private apply() {
    if (this.action) {
      const t0 = this.keyOffset + (this.current.start - this.clips.frame_start) / this.clips.fps;
      this.action.time = t0 + Math.min(this.time, this.duration);
      this.mixer.update(0);
    }
    if (this.inPlace && this.rootNode) this.rootNode.position.set(0, 0, 0);
    this.power = this.powerNode ? THREE.MathUtils.clamp(this.powerNode.scale.x, 0, 1) : 1;
    for (const g of this.glow) g.mat.emissiveIntensity = g.emissiveIntensity * this.power;
  }

  // -------------------------------------------------------------- inspection
  /** Resolve the part name that owns an intersected object. */
  ownerOf(obj: THREE.Object3D | null): string | null {
    let o: THREE.Object3D | null = obj;
    while (o) {
      if (this.parts[o.name] && this.partNodes.has(o.name)) return o.name;
      o = o.parent;
    }
    return null;
  }

  setHovered(name: string | null) {
    if (name === this.hovered) return;
    this.hovered = name;
    this.refreshHighlight();
  }

  setSelected(name: string | null) {
    this.selected = name;
    this.refreshHighlight();
  }

  setIsolate(on: boolean) {
    this.isolate = on;
    this.refreshHighlight();
  }

  setXray(on: boolean) {
    this.xray = on;
    for (const [name, node] of this.partNodes) {
      if (this.parts[name].category === "shell") node.visible = !on;
    }
  }

  setWireframe(on: boolean) {
    for (const recs of this.mats.values()) for (const r of recs) r.mat.wireframe = on;
  }

  private refreshHighlight() {
    for (const [name, recs] of this.mats) {
      const sel = name === this.selected;
      const hov = name === this.hovered;
      const dim = this.isolate && this.selected !== null && !sel;
      for (const r of recs) {
        if (!r.glow) {
          if (sel) {
            r.mat.emissive.copy(SELECT);
            r.mat.emissiveIntensity = 0.55;
          } else if (hov) {
            r.mat.emissive.copy(HOVER);
            r.mat.emissiveIntensity = 0.28;
          } else {
            r.mat.emissive.copy(r.emissive);
            r.mat.emissiveIntensity = r.emissiveIntensity;
          }
        }
        r.mat.transparent = dim ? true : r.transparent;
        r.mat.opacity = dim ? 0.08 : r.opacity;
        r.mat.depthWrite = dim ? false : r.depthWrite;
        r.mat.needsUpdate = true;
      }
    }
  }

  /** World-space bounding-box centre of a part (for labels / camera focus). */
  partCenter(name: string, target = new THREE.Vector3()) {
    const node = this.partNodes.get(name);
    if (!node) return target.set(0, 0.5, 0);
    return new THREE.Box3().setFromObject(node).getCenter(target);
  }

  partSize(name: string) {
    const node = this.partNodes.get(name);
    if (!node) return 0.3;
    return new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3()).length();
  }

  /** Release listeners and GPU materials. Safe to call more than once (React strict mode). */
  dispose() {
    this.listeners.clear();
    for (const recs of this.mats.values()) recs.forEach((r) => r.mat.dispose());
  }
}
