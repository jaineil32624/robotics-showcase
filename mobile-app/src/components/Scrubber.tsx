import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { C } from "../theme";

/** Touch timeline scrubber (no native slider dependency). */
export function Scrubber({ value, onSeek }: { value: number; onSeek: (fraction: number) => void }) {
  const width = useRef(1);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;

  const toFraction = (x: number) => Math.max(0, Math.min(1, x / width.current));
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const f = toFraction(e.nativeEvent.locationX);
        setDrag(f);
        onSeek(f);
      },
      onPanResponderMove: (e) => {
        const f = toFraction(e.nativeEvent.locationX);
        setDrag(f);
        onSeek(f);
      },
      onPanResponderRelease: () => setDrag(null),
      onPanResponderTerminate: () => setDrag(null),
    }),
  ).current;

  return (
    <View
      style={s.hit}
      onLayout={(e: LayoutChangeEvent) => (width.current = Math.max(1, e.nativeEvent.layout.width))}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={s.track}>
        <View style={[s.fill, { width: `${shown * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[s.thumb, { left: `${shown * 100}%` }]} />
    </View>
  );
}

const s = StyleSheet.create({
  hit: { height: 32, justifyContent: "center", flex: 1 },
  track: { height: 4, borderRadius: 2, backgroundColor: C.line2, overflow: "hidden" },
  fill: { height: 4, backgroundColor: C.signal },
  thumb: {
    position: "absolute",
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 3,
    backgroundColor: C.fg,
    borderWidth: 2,
    borderColor: C.signal,
  },
});
