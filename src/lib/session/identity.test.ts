import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSelectedPlayer,
  getSelectedPlayerId,
  isGroomPinValid,
  isGroomUnlocked,
  KeyValueStorage,
  lockGroom,
  selectPlayer,
  unlockGroom,
} from "./identity";

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

describe("player selection", () => {
  it("starts unpicked", () => {
    expect(getSelectedPlayerId(storage)).toBeNull();
  });

  it("remembers the selected player", () => {
    selectPlayer(storage, "p3");
    expect(getSelectedPlayerId(storage)).toBe("p3");
  });

  it("clearing forgets the player and re-locks groom tools", () => {
    selectPlayer(storage, "p3");
    unlockGroom(storage, "1234", "1234");
    clearSelectedPlayer(storage);
    expect(getSelectedPlayerId(storage)).toBeNull();
    expect(isGroomUnlocked(storage)).toBe(false);
  });
});

describe("groom PIN gate", () => {
  it("validates a matching PIN (trimmed)", () => {
    expect(isGroomPinValid(" 1234 ", "1234")).toBe(true);
    expect(isGroomPinValid("0000", "1234")).toBe(false);
  });

  it("never unlocks against a blank expected PIN", () => {
    expect(isGroomPinValid("", "")).toBe(false);
    expect(unlockGroom(storage, "", "")).toBe(false);
    expect(isGroomUnlocked(storage)).toBe(false);
  });

  it("unlocks and persists on a correct PIN", () => {
    expect(unlockGroom(storage, "1234", "1234")).toBe(true);
    expect(isGroomUnlocked(storage)).toBe(true);
  });

  it("does not unlock on a wrong PIN", () => {
    expect(unlockGroom(storage, "9999", "1234")).toBe(false);
    expect(isGroomUnlocked(storage)).toBe(false);
  });

  it("can be re-locked", () => {
    unlockGroom(storage, "1234", "1234");
    lockGroom(storage);
    expect(isGroomUnlocked(storage)).toBe(false);
  });
});
