import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import clipsJson from "../data/clips.json";
import partsJson from "../data/parts.json";
import type { Settings } from "../settings";
import { C, CATEGORY_COLOR, MONO } from "../theme";

interface Part {
  title: string;
  category: string;
  group: string;
  description: string;
  specs: Record<string, string>;
  mass_kg: number;
}
export const PARTS = partsJson as unknown as Record<string, Part>;
export const CLIPS = clipsJson.clips;

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={st.label}>{children}</Text>;
}

/* ---------------------------------------------------------------- clips */
export function AnimationsPanel({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  return (
    <ScrollView contentContainerStyle={st.pad}>
      <Label>{CLIPS.length} sequences · {clipsJson.frame_end} baked frames</Label>
      {CLIPS.map((c, i) => (
        <Pressable key={c.id} onPress={() => onPick(c.id)} style={[st.card, current === c.id && st.cardOn]}>
          <View style={st.row}>
            <Text style={st.idx}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={st.cardTitle}>{c.label}</Text>
            <Text style={st.meta}>{c.dur.toFixed(1)} s</Text>
          </View>
          <Text style={st.body}>{c.desc}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- parts */
const ORDER = ["Body", "Arm", "Leg FL", "Leg FR", "Leg RL", "Leg RR", "Props"];

export function PartsPanel({ onPick }: { onPick: (name: string) => void }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const m = new Map<string, [string, Part][]>();
    const n = q.trim().toLowerCase();
    for (const [k, p] of Object.entries(PARTS)) {
      if (n && !`${p.title} ${p.category} ${p.group}`.toLowerCase().includes(n)) continue;
      if (!m.has(p.group)) m.set(p.group, []);
      m.get(p.group)!.push([k, p]);
    }
    return [...m.entries()].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
  }, [q]);
  return (
    <ScrollView contentContainerStyle={st.pad} keyboardShouldPersistTaps="handled">
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search motors, pistons, gears…"
        placeholderTextColor={C.mute}
        style={st.input}
      />
      {groups.map(([g, list]) => (
        <View key={g} style={{ marginTop: 14 }}>
          <Label>
            {g} · {list.length}
          </Label>
          {list.map(([k, p]) => (
            <Pressable key={k} onPress={() => onPick(k)} style={st.partRow}>
              <View style={[st.dot, { backgroundColor: CATEGORY_COLOR[p.category] ?? C.mute }]} />
              <Text style={st.partText} numberOfLines={1}>
                {p.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- inspector */
export function PartCard({ name, onClose, onIsolate, isolated }: { name: string; onClose: () => void; onIsolate: () => void; isolated: boolean }) {
  const p = PARTS[name];
  if (!p) return null;
  return (
    <View style={st.inspector}>
      <View style={st.row}>
        <View style={[st.dot, { backgroundColor: CATEGORY_COLOR[p.category] ?? C.mute }]} />
        <Text style={[st.label, { flex: 1, marginBottom: 0 }]}>
          {p.category} · {p.group}
        </Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={st.close}>✕</Text>
        </Pressable>
      </View>
      <Text style={st.inspTitle}>{p.title}</Text>
      <ScrollView style={{ maxHeight: 170 }}>
        <Text style={st.body}>{p.description}</Text>
        {Object.entries(p.specs).map(([k, v]) => (
          <View key={k} style={st.specRow}>
            <Text style={st.specK}>{k}</Text>
            <Text style={st.specV}>{v}</Text>
          </View>
        ))}
      </ScrollView>
      <Pressable onPress={onIsolate} style={[st.btn, isolated && st.btnOn]}>
        <Text style={st.btnText}>{isolated ? "Show all parts" : "Isolate part"}</Text>
      </Pressable>
    </View>
  );
}

/* ---------------------------------------------------------------- specs */
const SPECS: [string, [string, string][]][] = [
  ["Overview", [["Actuated joints", "18 DOF"], ["Components", `${Object.keys(PARTS).length}`], ["Mass (sum of parts)", "≈ 54 kg"], ["Trot speed", "0.50 m/s"]]],
  ["Dimensions", [["Length", "1.10 m"], ["Width", "0.61 m"], ["Height, standing", "0.81 m"], ["Body height", "0.62 m"]]],
  ["Legs", [["Thigh / shin", "320 / 340 mm"], ["Knee drive", "Hydraulic, Ø32 mm"], ["Gait", "Diagonal trot, duty 0.6"], ["Step height", "75 mm"]]],
  ["Arm", [["DOF", "5 + gripper"], ["Reach", "0.93 m"], ["Payload", "5 kg"], ["Wrist roll", "Continuous"]]],
  ["Power", [["Battery", "48 V · 24 Ah · 1.15 kWh"], ["Hydraulics", "21 MPa · 6.5 L/min"], ["Runtime (est.)", "≈ 2.4 h"]]],
  ["Sensing", [["Lidar", "32-ch · 120 m"], ["Depth", "Stereo, 120 mm baseline"], ["Control loop", "1 kHz"]]],
];

export function SpecsPanel() {
  return (
    <ScrollView contentContainerStyle={st.pad}>
      {SPECS.map(([title, rows]) => (
        <View key={title} style={st.specGroup}>
          <Text style={st.specGroupTitle}>{title}</Text>
          {rows.map(([k, v]) => (
            <View key={k} style={st.specRow}>
              <Text style={st.specK}>{k}</Text>
              <Text style={st.specV}>{v}</Text>
            </View>
          ))}
        </View>
      ))}
      <Text style={[st.body, { marginTop: 8 }]}>Performance values are design targets for this concept prototype.</Text>
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- settings */
function Segment<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View style={st.segment}>
      {options.map(([v, l]) => (
        <Pressable key={String(v)} onPress={() => onChange(v)} style={[st.segItem, value === v && st.segOn]}>
          <Text style={[st.segText, value === v && { color: C.fg }]}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <View style={st.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.partText}>{label}</Text>
        {hint ? <Text style={st.meta}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.signal, false: C.line2 }} thumbColor={C.fg} />
    </View>
  );
}

export function SettingsPanel({
  settings,
  update,
  xray,
  setXray,
  wire,
  setWire,
}: {
  settings: Settings;
  update: (p: Partial<Settings>) => void;
  xray: boolean;
  setXray: (b: boolean) => void;
  wire: boolean;
  setWire: (b: boolean) => void;
}) {
  return (
    <ScrollView contentContainerStyle={st.pad}>
      <Label>Rendering quality</Label>
      <Segment value={settings.quality} options={[[0, "Battery"], [1, "Balanced"], [2, "High"]]} onChange={(q) => update({ quality: q })} />
      <Text style={[st.meta, { marginTop: 6 }]}>Controls pixel ratio and real-time shadows.</Text>
      <View style={{ height: 18 }} />
      <Label>Playback speed</Label>
      <Segment value={settings.speed} options={[[0.25, "¼×"], [0.5, "½×"], [1, "1×"], [2, "2×"]]} onChange={(v) => update({ speed: v })} />
      <View style={{ height: 18 }} />
      <Label>Viewer</Label>
      <Toggle label="Show FPS" value={settings.showFps} onChange={(b) => update({ showFps: b })} />
      <Toggle label="Auto-orbit camera" value={settings.autoRotate} onChange={(b) => update({ autoRotate: b })} />
      <Toggle label="Follow robot" hint="Camera tracks the robot while walking" value={settings.follow} onChange={(b) => update({ follow: b })} />
      <Toggle label="Walk in place" hint="Lock the root so walk cycles stay centred" value={settings.inPlace} onChange={(b) => update({ inPlace: b })} />
      <Toggle label="X-ray (hide shell)" value={xray} onChange={setXray} />
      <Toggle label="Wireframe" value={wire} onChange={setWire} />
    </ScrollView>
  );
}

export function AboutPanel() {
  return (
    <ScrollView contentContainerStyle={st.pad}>
      <Text style={st.inspTitle}>ARGO-Q4 Robotics Showcase</Text>
      <Text style={st.body}>
        A hydraulic quadruped field robot with a 5-DOF manipulator, designed procedurally in Blender from motors, pistons, gears,
        bearings and hoses, and animated with real inverse kinematics.
      </Text>
      <Text style={st.body}>
        This app renders the same 3D asset and runtime code as the website, entirely offline: the model and renderer are bundled
        inside the APK.
      </Text>
      <View style={{ height: 12 }} />
      <Label>Controls</Label>
      <Text style={st.body}>One finger: orbit · Pinch: zoom · Two fingers: pan · Tap a part: inspect</Text>
      <View style={{ height: 12 }} />
      <Label>Author</Label>
      <Text style={st.body}>Jaineil Rana · github.com/jaineil32624/robotics-showcase</Text>
      <Text style={[st.meta, { marginTop: 12 }]}>Version 1.0.0 · MIT License</Text>
    </ScrollView>
  );
}

export const st = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 40 },
  label: { fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: C.mute, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 12, marginBottom: 8, backgroundColor: C.ink },
  cardOn: { borderColor: C.signal, backgroundColor: "rgba(255,90,31,0.08)" },
  idx: { fontFamily: MONO, fontSize: 11, color: C.mute },
  cardTitle: { flex: 1, color: C.fg, fontSize: 15, fontWeight: "600" },
  meta: { fontFamily: MONO, fontSize: 11, color: C.mute },
  body: { color: C.soft, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
  input: { borderWidth: 1, borderColor: C.line2, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, color: C.fg, backgroundColor: C.ink },
  partRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  partText: { color: C.fg, fontSize: 14, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  inspector: { backgroundColor: "rgba(13,17,22,0.96)", borderColor: C.line2, borderWidth: 1, borderRadius: 8, padding: 14 },
  inspTitle: { color: C.fg, fontSize: 18, fontWeight: "700", marginTop: 6 },
  close: { color: C.mute, fontSize: 16, paddingHorizontal: 4 },
  specRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  specK: { color: C.mute, fontSize: 13, flex: 1 },
  specV: { color: C.fg, fontSize: 13, fontFamily: MONO, flexShrink: 1, textAlign: "right" },
  specGroup: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 12, marginBottom: 12 },
  specGroupTitle: { color: C.soft, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  btn: { marginTop: 12, borderWidth: 1, borderColor: C.line2, borderRadius: 6, paddingVertical: 9, alignItems: "center" },
  btnOn: { borderColor: C.signal },
  btnText: { color: C.fg, fontSize: 13 },
  segment: { flexDirection: "row", borderWidth: 1, borderColor: C.line2, borderRadius: 6, overflow: "hidden" },
  segItem: { flex: 1, paddingVertical: 9, alignItems: "center" },
  segOn: { backgroundColor: "rgba(255,90,31,0.18)" },
  segText: { color: C.soft, fontSize: 13 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, gap: 12 },
});
