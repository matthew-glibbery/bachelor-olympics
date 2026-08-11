/**
 * Session identity — the shared-link "name picker" model (Phase 1 auth
 * decision). No accounts: a device picks which of the 8 competitors it's acting
 * as, and the groom's admin tools unlock with a shared PIN. All of it is
 * app-level (see supabase/migrations/0002_rls.sql for why the DB can't enforce
 * per-player ownership in this model).
 *
 * Pure logic behind a tiny storage interface so it unit-tests in node and backs
 * onto localStorage in the browser (src/lib/session/browserStorage.ts).
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SELECTED_PLAYER_KEY = "bo.selectedPlayerId";
export const GROOM_UNLOCKED_KEY = "bo.groomUnlocked";

/** The player id this device is currently acting as, or null if unpicked. */
export function getSelectedPlayerId(storage: KeyValueStorage): string | null {
  return storage.getItem(SELECTED_PLAYER_KEY);
}

/** Act as `playerId` on this device. */
export function selectPlayer(storage: KeyValueStorage, playerId: string): void {
  storage.setItem(SELECTED_PLAYER_KEY, playerId);
}

/** Forget who this device was acting as (and re-lock groom tools). */
export function clearSelectedPlayer(storage: KeyValueStorage): void {
  storage.removeItem(SELECTED_PLAYER_KEY);
  lockGroom(storage);
}

/**
 * Whether an entered PIN matches the groom PIN. A blank expected PIN never
 * unlocks (guards a misconfigured/empty env from opening the admin tools).
 */
export function isGroomPinValid(entered: string, expected: string): boolean {
  if (!expected) return false;
  return entered.trim() === expected.trim();
}

/** Try to unlock the groom tools; persists the unlock on success. */
export function unlockGroom(
  storage: KeyValueStorage,
  entered: string,
  expected: string,
): boolean {
  if (!isGroomPinValid(entered, expected)) return false;
  storage.setItem(GROOM_UNLOCKED_KEY, "1");
  return true;
}

/** Whether the groom tools are unlocked on this device. */
export function isGroomUnlocked(storage: KeyValueStorage): boolean {
  return storage.getItem(GROOM_UNLOCKED_KEY) === "1";
}

/** Re-lock the groom tools on this device. */
export function lockGroom(storage: KeyValueStorage): void {
  storage.removeItem(GROOM_UNLOCKED_KEY);
}
