import type { KeyValueStorage } from "./identity";

/**
 * localStorage-backed KeyValueStorage for the browser. During SSR (no window)
 * it degrades to a no-op so imports never throw; the real values load on the
 * client after hydration.
 */
const noopStorage: KeyValueStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export function getBrowserStorage(): KeyValueStorage {
  if (typeof window === "undefined" || !window.localStorage) {
    return noopStorage;
  }
  return window.localStorage;
}
