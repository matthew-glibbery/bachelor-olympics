import { describe, expect, it } from "vitest";
import { EVENTS, eventCount, getEvent } from "./config";

describe("events/config", () => {
  it("exposes a dynamic count that matches the list length", () => {
    expect(eventCount()).toBe(EVENTS.length);
  });

  it("has unique event ids", () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marks golf as absolute, lower-is-better", () => {
    const golf = getEvent("golf");
    expect(golf?.scoringMode).toBe("absolute");
    expect(golf?.lowerIsBetter).toBe(true);
  });

  it("flags Stump for a safety check", () => {
    expect(getEvent("stump")?.safetyCheck).toBe(true);
  });

  it("returns undefined for an unknown event", () => {
    expect(getEvent("nope")).toBeUndefined();
  });
});
