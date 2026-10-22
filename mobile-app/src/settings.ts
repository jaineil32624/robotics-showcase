import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export interface Settings {
  quality: 0 | 1 | 2;
  showFps: boolean;
  autoRotate: boolean;
  follow: boolean;
  inPlace: boolean;
  speed: number;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 1,
  showFps: false,
  autoRotate: false,
  follow: true,
  inPlace: false,
  speed: 1,
};

const KEY = "argo.settings.v1";

/** Settings persisted on-device (works fully offline). */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) });
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  return { settings, update, loaded };
}
