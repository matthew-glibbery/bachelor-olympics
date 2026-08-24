"use client";

import { useEffect, useRef } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { settleStrandedPerEventBets } from "@/lib/data/mutations";

/**
 * Settle any per-event bet left "open" on an already-resolved event, once
 * per page visit.
 *
 * This exists because of a real bug that stranded live bets (see
 * settleStrandedPerEventBets): a winning bet on an absolute-scored event was
 * never settled at finalize time, so it sat open with the player's stake
 * escrowed. The finalize path is fixed, but a bet already stranded needs
 * something to come back for it, and nothing in the normal flow ever
 * revisits a resolved event.
 *
 * Mounted on the two screens where those bets are visible (/events, /bets),
 * so whoever looks at them first repairs them for everyone — the write goes
 * through Supabase realtime like any other, so other devices update on their
 * own. Failures are swallowed on purpose: this is a background repair, and a
 * player who can't write (or is offline) should still get the page.
 */
export function useSettleStrandedBets(ready: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    settleStrandedPerEventBets(getSupabaseBrowserClient()).catch(() => {});
  }, [ready]);
}
