"use client";

import { useEffect } from "react";

import { useGameStore } from "@/store/gameStore";
import { DEFAULT_THEME_ID, getTheme } from "@/lib/themes";

/**
 * Applies the shared app theme (src/lib/themes.ts) live, on every device.
 * Mounted once in the root layout. Writes the active theme's tokens as
 * inline styles on <html> — inline styles win over the static :root values
 * in globals.css without needing a second stylesheet, and update instantly
 * when app_settings changes (gameStore's Realtime subscription already
 * covers that table).
 *
 * Only the light token set is applied — this app has no dark-mode toggle
 * wired up yet (nothing ever adds the `.dark` class), so `theme.dark` is
 * captured in the data but not live. See src/lib/themes.ts.
 */
export function ThemeApplier() {
  const appSettings = useGameStore((s) => s.appSettings);
  const connect = useGameStore((s) => s.connect);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    const theme = getTheme(appSettings?.theme_id ?? DEFAULT_THEME_ID);
    const root = document.documentElement.style;
    for (const [key, value] of Object.entries(theme.light)) {
      root.setProperty(`--${key}`, value);
    }
  }, [appSettings?.theme_id]);

  return null;
}
