"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { THEMES } from "@/lib/themes";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setTheme } from "@/lib/data/mutations";

/**
 * Groom-tools theme picker. Swaps the shared app theme (src/lib/themes.ts) —
 * live for every device, since app_settings is Realtime-subscribed in
 * gameStore. See src/components/theme-applier.tsx for how a pick takes
 * effect.
 */
export function ThemePicker({ activeThemeId }: { activeThemeId: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(themeId: string) {
    if (themeId === activeThemeId) return;
    setPending(themeId);
    setError(null);
    try {
      await setTheme(getSupabaseBrowserClient(), themeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEMES.map((theme) => {
          const active = theme.id === activeThemeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => pick(theme.id)}
              disabled={pending !== null}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-2.5 text-left transition-colors disabled:opacity-60",
                active ? "border-primary ring-primary/30 ring-2" : "hover:bg-accent",
              )}
              style={{ backgroundColor: theme.light.background }}
            >
              <div className="flex items-center gap-1.5">
                {["primary", "secondary", "accent", "destructive"].map((role) => (
                  <span
                    key={role}
                    aria-hidden
                    className="size-3.5 rounded-full border"
                    style={{
                      backgroundColor: theme.light[role as keyof typeof theme.light],
                      borderColor: theme.light.border,
                    }}
                  />
                ))}
              </div>
              <span
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: theme.light.foreground }}
              >
                {active ? <Check className="size-3.5" /> : null}
                {theme.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
