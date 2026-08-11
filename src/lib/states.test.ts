import { describe, expect, it } from "vitest";
import { isStateCode, stateName, stateOptions, US_STATES } from "./states";

describe("states", () => {
  it("resolves a known code to its full name", () => {
    expect(stateName("TX")).toBe("Texas");
    expect(stateName("NY")).toBe("New York");
  });

  it("falls back to the raw code when unknown", () => {
    expect(stateName("ZZ")).toBe("ZZ");
  });

  it("recognises valid codes", () => {
    expect(isStateCode("CA")).toBe(true);
    expect(isStateCode("ZZ")).toBe(false);
  });

  it("offers every state as a picker option, alphabetised by name", () => {
    const opts = stateOptions();
    expect(opts).toHaveLength(Object.keys(US_STATES).length);
    const names = opts.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
