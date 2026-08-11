import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, getTheme, THEMES } from "./themes";

const REQUIRED_KEYS = [
  "radius",
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

describe("THEMES", () => {
  it("has unique ids", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the classic default", () => {
    expect(THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
  });

  it("every theme defines every token, light and dark", () => {
    for (const theme of THEMES) {
      for (const key of REQUIRED_KEYS) {
        expect(theme.light[key], `${theme.id}.light.${key}`).toBeTruthy();
        expect(theme.dark[key], `${theme.id}.dark.${key}`).toBeTruthy();
      }
    }
  });

  it("has at least one real tweakcn preset besides classic", () => {
    expect(THEMES.length).toBeGreaterThan(1);
  });
});

describe("getTheme", () => {
  it("finds a theme by id", () => {
    expect(getTheme("twitter").name).toBe("Twitter");
  });

  it("falls back to the first theme for an unknown id", () => {
    expect(getTheme("nonexistent").id).toBe(THEMES[0]!.id);
  });
});
