/**
 * ARGO-Q4 — Android showcase app.
 *
 * Native React Native shell (menus, settings, playback controls, inspector)
 * around a bundled WebGL renderer that shares its runtime with the website.
 */
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Scrubber } from "./src/components/Scrubber";
import { AboutPanel, AnimationsPanel, CLIPS, PartCard, PartsPanel, SettingsPanel, SpecsPanel } from "./src/components/Panels";
import { useSettings } from "./src/settings";
import { C, MONO } from "./src/theme";

type Panel = null | "menu" | "animations" | "parts" | "specs" | "settings" | "about";

interface PlayState {
  clipId: string;
  playing: boolean;
  time: number;
  duration: number;
  label: string;
  power: number;
  fps?: number;
}

const VIEWER_URI = Platform.OS === "android" ? "file:///android_asset/viewer/index.html" : "viewer/index.html";
const MENU: { id: Exclude<Panel, null | "menu">; label: string; hint: string }[] = [
  { id: "animations", label: "Animations", hint: "10 engineered sequences" },
  { id: "parts", label: "Components", hint: "Inspect every mechanical part" },
  { id: "specs", label: "Engineering specs", hint: "Dimensions, power, kinematics" },
  { id: "settings", label: "Settings", hint: "Quality, camera, playback" },
  { id: "about", label: "About", hint: "Project & controls" },
];
const VIEWS = ["iso", "front", "side", "top", "rear"] as const;
const TOP = (RNStatusBar.currentHeight ?? 24) + 6;

export default function App() {
  const web = useRef<WebView>(null);
  const { settings, update, loaded } = useSettings();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [isolated, setIsolated] = useState(false);
  const [xray, setXray] = useState(false);
  const [wire, setWire] = useState(false);
  const [explode, setExplode] = useState(0);
  const sheet = useRef(new Animated.Value(0)).current;

  /** Invoke a command on the WebGL side. */
  const cmd = useCallback((name: string, ...args: unknown[]) => {
    const js = `window.argo && window.argo.${name}(${args.map((a) => JSON.stringify(a)).join(",")}); true;`;
    web.current?.injectJavaScript(js);
  }, []);

  // push persisted settings into the renderer once both sides are ready
  useEffect(() => {
    if (!ready || !loaded) return;
    cmd("setQuality", settings.quality);
    cmd("setShowFps", settings.showFps);
    cmd("setAutoRotate", settings.autoRotate);
    cmd("setFollow", settings.follow);
    cmd("setInPlace", settings.inPlace);
    cmd("setSpeed", settings.speed);
  }, [ready, loaded, settings, cmd]);

  useEffect(() => {
    if (ready) cmd("setXray", xray);
  }, [ready, xray, cmd]);
  useEffect(() => {
    if (ready) cmd("setWireframe", wire);
  }, [ready, wire, cmd]);

  // panel slide animation
  useEffect(() => {
    Animated.timing(sheet, {
      toValue: panel ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [panel, sheet]);

  // Android hardware back closes overlays before leaving the app
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (panel) {
        setPanel(panel === "menu" ? null : "menu");
        return true;
      }
      if (selected) {
        setSelected(null);
        cmd("select", null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [panel, selected, cmd]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "ready") setReady(true);
    else if (msg.type === "state") setPlay(msg as unknown as PlayState);
    else if (msg.type === "select") {
      setSelected((msg.name as string) ?? null);
      setIsolated(false);
    } else if (msg.type === "error") setError(String(msg.message));
  };

  const pickClip = (id: string) => {
    cmd("setClip", id);
    setExplode(0);
    setPanel(null);
  };
  const pickPart = (name: string) => {
    cmd("select", name);
    setSelected(name);
    setIsolated(false);
    setPanel(null);
  };

  const progress = play && play.duration > 0 ? play.time / play.duration : 0;
  const translateY = sheet.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  return (
    <View style={s.root}>
      <StatusBar style="light" translucent />
      <WebView
        ref={web}
        source={{ uri: VIEWER_URI }}
        originWhitelist={["*"]}
        allowFileAccess
        allowFileAccessFromFileURLs
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        style={s.web}
        containerStyle={s.web}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        androidLayerType="hardware"
        onError={(e) => setError(e.nativeEvent.description)}
      />

      {!ready && !error && (
        <View style={s.boot} pointerEvents="none">
          <Text style={s.bootTitle}>ARGO-Q4</Text>
          <Text style={s.mono}>Initialising renderer…</Text>
        </View>
      )}
      {error && (
        <View style={s.boot}>
          <Text style={s.bootTitle}>Renderer error</Text>
          <Text style={[s.mono, { textAlign: "center", paddingHorizontal: 24 }]}>{error}</Text>
        </View>
      )}

      {/* top bar */}
      <View style={[s.top, { paddingTop: TOP }]} pointerEvents="box-none">
        <Pressable style={s.iconBtn} onPress={() => setPanel(panel ? null : "menu")} hitSlop={8}>
          <Text style={s.iconText}>☰</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>ARGO-Q4</Text>
          <Text style={s.mono} numberOfLines={1}>
            {play ? play.label : "Loading"}
            {play ? `  ·  PWR ${(play.power * 100).toFixed(0)}%` : ""}
            {play?.fps ? `  ·  ${play.fps} FPS` : ""}
          </Text>
        </View>
        <Pressable style={s.iconBtn} onPress={() => setPanel("parts")} hitSlop={8}>
          <Text style={s.chipText}>PARTS</Text>
        </Pressable>
      </View>

      {/* camera views + x-ray / explode quick tools */}
      <View style={[s.tools, { top: TOP + 52 }]} pointerEvents="box-none">
        {VIEWS.map((v) => (
          <Pressable key={v} style={s.tool} onPress={() => cmd("view", v)}>
            <Text style={s.toolText}>{v.toUpperCase()}</Text>
          </Pressable>
        ))}
        <Pressable style={[s.tool, xray && s.toolOn]} onPress={() => setXray(!xray)}>
          <Text style={[s.toolText, xray && { color: C.glow }]}>X-RAY</Text>
        </Pressable>
        <Pressable
          style={[s.tool, explode > 0 && s.toolOn]}
          onPress={() => {
            const next = explode > 0 ? 0 : 1;
            setExplode(next);
            if (next) cmd("setExplode", 1);
            else cmd("setClip", "idle");
          }}
        >
          <Text style={[s.toolText, explode > 0 && { color: C.glow }]}>EXPLODE</Text>
        </Pressable>
      </View>

      {/* part inspector */}
      {selected && !panel && (
        <View style={s.inspectorWrap}>
          <PartCard
            name={selected}
            isolated={isolated}
            onClose={() => {
              setSelected(null);
              setIsolated(false);
              cmd("setIsolate", false);
              cmd("select", null);
            }}
            onIsolate={() => {
              cmd("setIsolate", !isolated);
              setIsolated(!isolated);
            }}
          />
        </View>
      )}

      {/* playback dock */}
      <View style={s.dock}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
          {CLIPS.map((c) => (
            <Pressable key={c.id} onPress={() => pickClip(c.id)} style={[s.chip, play?.clipId === c.id && s.chipOn]}>
              <Text style={[s.chipText, play?.clipId === c.id && { color: C.fg }]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={s.transport}>
          <Pressable style={s.play} onPress={() => cmd("toggle")}>
            <Text style={s.playText}>{play?.playing ? "❚❚" : "▶"}</Text>
          </Pressable>
          <Text style={s.time}>{play ? play.time.toFixed(1) : "0.0"}s</Text>
          <Scrubber value={progress} onSeek={(f) => cmd("seek", f)} />
          <Text style={s.time}>{play ? play.duration.toFixed(1) : "0.0"}s</Text>
        </View>
      </View>

      {/* sheets */}
      {panel && <Pressable style={s.scrim} onPress={() => setPanel(null)} />}
      <Animated.View
        pointerEvents={panel ? "auto" : "none"}
        style={[s.sheet, { transform: [{ translateY }], opacity: sheet }]}
      >
        <View style={s.sheetHead}>
          {panel && panel !== "menu" ? (
            <Pressable onPress={() => setPanel("menu")} hitSlop={10}>
              <Text style={s.back}>‹ Menu</Text>
            </Pressable>
          ) : (
            <Text style={s.sheetTitle}>ARGO-Q4</Text>
          )}
          <Pressable onPress={() => setPanel(null)} hitSlop={10}>
            <Text style={s.back}>Close</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          {panel === "menu" && (
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              {MENU.map((m) => (
                <Pressable key={m.id} onPress={() => setPanel(m.id)} style={s.menuItem}>
                  <Text style={s.menuLabel}>{m.label}</Text>
                  <Text style={s.mono}>{m.hint}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {panel === "animations" && <AnimationsPanel current={play?.clipId ?? "idle"} onPick={pickClip} />}
          {panel === "parts" && <PartsPanel onPick={pickPart} />}
          {panel === "specs" && <SpecsPanel />}
          {panel === "settings" && (
            <SettingsPanel settings={settings} update={update} xray={xray} setXray={setXray} wire={wire} setWire={setWire} />
          )}
          {panel === "about" && <AboutPanel />}
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ink },
  web: { flex: 1, backgroundColor: C.ink },
  boot: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: C.ink, gap: 8 },
  bootTitle: { color: C.fg, fontSize: 28, fontWeight: "700", letterSpacing: 3 },
  mono: { fontFamily: MONO, fontSize: 11, color: C.mute },
  top: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: "rgba(7,9,12,0.72)" },
  title: { color: C.fg, fontSize: 16, fontWeight: "700", letterSpacing: 2 },
  iconBtn: { minWidth: 40, height: 40, borderRadius: 6, borderWidth: 1, borderColor: C.line2, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, backgroundColor: "rgba(13,17,22,0.8)" },
  iconText: { color: C.fg, fontSize: 18 },
  tools: { position: "absolute", right: 10, alignItems: "flex-end", gap: 6 },
  tool: { borderWidth: 1, borderColor: C.line2, borderRadius: 5, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(13,17,22,0.8)" },
  toolOn: { borderColor: C.glow, backgroundColor: "rgba(56,214,255,0.1)" },
  toolText: { fontFamily: MONO, fontSize: 10.5, color: C.soft },
  inspectorWrap: { position: "absolute", left: 10, right: 10, bottom: 128 },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 18, backgroundColor: "rgba(7,9,12,0.88)", borderTopWidth: 1, borderTopColor: C.line, gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line2, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 7 },
  chipOn: { borderColor: C.signal, backgroundColor: "rgba(255,90,31,0.15)" },
  chipText: { color: C.soft, fontSize: 12, fontFamily: MONO },
  transport: { flexDirection: "row", alignItems: "center", gap: 10 },
  play: { width: 40, height: 40, borderRadius: 6, backgroundColor: C.signal, alignItems: "center", justifyContent: "center" },
  playText: { color: C.ink, fontSize: 15, fontWeight: "800" },
  time: { fontFamily: MONO, fontSize: 11, color: C.soft, width: 44, textAlign: "center" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, height: "78%", backgroundColor: C.panel, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderTopWidth: 1, borderColor: C.line2 },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  sheetTitle: { color: C.fg, fontSize: 15, fontWeight: "700", letterSpacing: 2 },
  back: { color: C.signal, fontSize: 14 },
  menuItem: { paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  menuLabel: { color: C.fg, fontSize: 17, fontWeight: "600", marginBottom: 3 },
});
