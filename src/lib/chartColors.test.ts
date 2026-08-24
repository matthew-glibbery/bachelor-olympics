import { describe, expect, it } from "vitest";
import { assignPlayerColors } from "./chartColors";

describe("assignPlayerColors", () => {
  it("gives every player a distinct color for a full 8-player field", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      state: "WY", // no flag match — pure fallback
    }));
    const colors = assignPlayerColors(players);
    const values = Object.values(colors);
    expect(new Set(values).size).toBe(8);
  });

  it("gives a listed state its flag-inspired slot when unclaimed", () => {
    const colors = assignPlayerColors([{ id: "p1", state: "AZ" }]);
    expect(colors.p1).toBe("#eb6834"); // orange slot
  });

  it("falls back to the next free slot on a collision", () => {
    // Both AZ (players) prefer orange; the second must get a different slot.
    const colors = assignPlayerColors([
      { id: "p1", state: "AZ" },
      { id: "p2", state: "az" }, // case-insensitive
    ]);
    expect(colors.p1).toBe("#eb6834"); // orange, claimed first
    expect(colors.p2).not.toBe(colors.p1);
  });

  it("assigns unmapped states sequentially in fixed slot order", () => {
    const colors = assignPlayerColors([
      { id: "p1", state: "WY" },
      { id: "p2", state: "WI" },
    ]);
    expect(colors.p1).toBe("#2a78d6"); // blue, first free slot
    expect(colors.p2).toBe("#eb6834"); // orange, next free slot
  });

  it("is deterministic for the same input order", () => {
    const players = [
      { id: "p1", state: "TX" },
      { id: "p2", state: "CA" },
      { id: "p3", state: "WY" },
    ];
    expect(assignPlayerColors(players)).toEqual(assignPlayerColors(players));
  });

  it("uses the dark hex set in dark mode without changing the slot logic", () => {
    const light = assignPlayerColors([{ id: "p1", state: "AZ" }], "light");
    const dark = assignPlayerColors([{ id: "p1", state: "AZ" }], "dark");
    expect(light.p1).toBe("#eb6834");
    expect(dark.p1).toBe("#d95926");
  });

  it("cycles rather than crashing beyond 8 players", () => {
    const players = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      state: "WY",
    }));
    const colors = assignPlayerColors(players);
    expect(Object.keys(colors)).toHaveLength(10);
    for (const value of Object.values(colors)) {
      expect(typeof value).toBe("string");
    }
  });
});

describe("pinned colours", () => {
  it("gives Josh green and Matthew violet regardless of roster order", () => {
    const roster = [
      { id: "1", state: "AZ", name: "Andrew" },
      { id: "2", state: "NY", name: "Josh" },
      { id: "3", state: "CA", name: "Matthew" },
      { id: "4", state: "TX", name: "Joe" },
    ];
    const colors = assignPlayerColors(roster, "dark");
    expect(colors["2"]).toBe("#008300");
    expect(colors["3"]).toBe("#9085e9");

    // The whole point of the pin: removing another player must not move them.
    const smaller = assignPlayerColors(roster.filter((p) => p.id !== "1"), "dark");
    expect(smaller["2"]).toBe("#008300");
    expect(smaller["3"]).toBe("#9085e9");
  });

  it("matches the pin case-insensitively and never double-assigns a slot", () => {
    const colors = assignPlayerColors(
      [
        { id: "1", state: "NY", name: "JOSH" },
        { id: "2", state: "NY", name: "Matthew" },
        { id: "3", state: "NY", name: "Sam" },
      ],
      "dark",
    );
    expect(colors["1"]).toBe("#008300");
    expect(colors["2"]).toBe("#9085e9");
    expect(new Set(Object.values(colors)).size).toBe(3);
  });

  it("leaves everyone unpinned when no names are supplied", () => {
    const colors = assignPlayerColors([{ id: "1", state: "NY" }], "dark");
    expect(colors["1"]).toBeDefined();
  });
});
