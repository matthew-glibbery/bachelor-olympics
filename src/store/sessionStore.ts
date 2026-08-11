/**
 * This device's identity — which player it's acting as, and whether the groom
 * tools are unlocked. Thin zustand wrapper over the pure logic in
 * src/lib/session/identity.ts, backed by localStorage.
 */
import { create } from "zustand";
import {
  clearSelectedPlayer as clearSelectedPlayerImpl,
  getSelectedPlayerId,
  isGroomUnlocked,
  lockGroom as lockGroomImpl,
  markGroomUnlocked,
  selectPlayer as selectPlayerImpl,
} from "@/lib/session/identity";
import { getBrowserStorage } from "@/lib/session/browserStorage";

interface SessionState {
  selectedPlayerId: string | null;
  groomUnlocked: boolean;
  /** Read initial state from localStorage — call once on mount, client-side. */
  hydrate: () => void;
  selectPlayer: (playerId: string) => void;
  clearSelectedPlayer: () => void;
  /** Calls /api/groom/unlock; returns whether the PIN was accepted. */
  unlockGroom: (pin: string) => Promise<boolean>;
  lockGroom: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  selectedPlayerId: null,
  groomUnlocked: false,

  hydrate: () => {
    const storage = getBrowserStorage();
    set({
      selectedPlayerId: getSelectedPlayerId(storage),
      groomUnlocked: isGroomUnlocked(storage),
    });
  },

  selectPlayer: (playerId) => {
    selectPlayerImpl(getBrowserStorage(), playerId);
    set({ selectedPlayerId: playerId });
  },

  clearSelectedPlayer: () => {
    clearSelectedPlayerImpl(getBrowserStorage());
    set({ selectedPlayerId: null, groomUnlocked: false });
  },

  unlockGroom: async (pin) => {
    const res = await fetch("/api/groom/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const { ok } = (await res.json()) as { ok: boolean };
    if (ok) {
      // Server already confirmed the PIN; just persist the local flag.
      markGroomUnlocked(getBrowserStorage());
      set({ groomUnlocked: true });
    }
    return ok;
  },

  lockGroom: () => {
    lockGroomImpl(getBrowserStorage());
    set({ groomUnlocked: false });
  },
}));
