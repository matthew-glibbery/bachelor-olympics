"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { spendPowerMove } from "@/lib/data/mutations";
import type { PowerMoveRow } from "@/lib/data/database.types";

/**
 * The groom's one-time power move (PRODUCT_SPEC.md → Extras). Deliberately
 * undefined mechanic — "the fun is in the surprise and timing" — so this is
 * just a note field + a big one-shot button, not a picker of specific
 * effects. Visible to everyone once used, so the surprise lands publicly.
 */
export function PowerMoveCard({ powerMove }: { powerMove: PowerMoveRow | null }) {
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUse() {
    setBusy(true);
    setError(null);
    try {
      await spendPowerMove(getSupabaseBrowserClient(), note.trim());
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="text-primary size-5" />
          Power move
        </CardTitle>
        <CardDescription>
          One intervention, any time this weekend — double a bet&apos;s
          stakes, force a rematch, whatever you want. Usable exactly once.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {powerMove?.used ? (
          <div className="rounded-md border px-3 py-2 text-sm">
            <p className="font-medium">Used{powerMove.used_at ? ` — ${new Date(powerMove.used_at).toLocaleString()}` : ""}</p>
            {powerMove.note ? (
              <p className="text-muted-foreground">{powerMove.note}</p>
            ) : null}
          </div>
        ) : (
          <>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="power-move-note">What did you do? (optional)</Label>
              <Input
                id="power-move-note"
                placeholder="e.g. Doubled Andrew's stump bet"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">Use your one power move now?</span>
                <Button size="sm" onClick={handleUse} disabled={busy}>
                  Yes, use it
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button className="w-fit" onClick={() => setConfirming(true)}>
                <Sparkles className="size-4" />
                Use the power move
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
