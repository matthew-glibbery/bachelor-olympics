/**
 * US states reference — players are repped by a US state, Olympics-delegation
 * style. Two-letter USPS codes → full names. Used by the player-setup state
 * picker and chartColors.ts's flag-inspired hue preferences (the visual state
 * "flag" chip itself was dropped from the UI — photos are the primary avatar
 * identifier now).
 */

export const US_STATES: Readonly<Record<string, string>> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
} as const;

export type StateCode = keyof typeof US_STATES;

/** Full state name for a code, or the raw code if it's not recognised. */
export function stateName(code: string): string {
  return US_STATES[code as StateCode] ?? code;
}

/** True if `code` is a known USPS state code. */
export function isStateCode(code: string): code is StateCode {
  return code in US_STATES;
}

/** All states as `{ code, name }`, alphabetised by name — for pickers. */
export function stateOptions(): { code: StateCode; name: string }[] {
  return (Object.entries(US_STATES) as [StateCode, string][])
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
