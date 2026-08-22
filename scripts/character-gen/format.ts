/** "A, B, and C" — used wherever a prompt needs to name every character in
 * a multi-reference-image scene. Shared by prompts.ts and victoryBeats.ts. */
export function nameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
