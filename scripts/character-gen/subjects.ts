/**
 * A "subject" is anything the pipeline can generate a portrait for.
 * Competing players come from Supabase (players.ts); Cassandra (the bride)
 * and Bailey (the dog) are portrait-only guests — they never get their own
 * select/fullbody clips, only a stylized image used as extra reference
 * material for the composite scenes (victory, confirm, boot) in
 * composites.ts. Extend SPECIAL_SUBJECTS here if more guests are wanted
 * later; nothing else needs to change to support a third one.
 */
import { fetchPlayers, slugify, type PlayerRow } from "./players";

export type SubjectKind = "player" | "guest" | "pet";

export type Subject = {
  key: string; // slug, also the character-assets/<key>/ dirname
  name: string;
  kind: SubjectKind;
  player?: PlayerRow; // set only when kind === "player"
};

export const SPECIAL_SUBJECTS: Subject[] = [
  { key: "cassandra", name: "Cassandra", kind: "guest" },
  { key: "bailey", name: "Bailey", kind: "pet" },
];

export async function resolveSubject(nameOrId: string): Promise<Subject> {
  const players = await fetchPlayers();
  const player = players.find(
    (p) => p.id === nameOrId || p.name.toLowerCase() === nameOrId.toLowerCase() || slugify(p.name) === slugify(nameOrId),
  );
  if (player) return { key: slugify(player.name), name: player.name, kind: "player", player };

  const special = SPECIAL_SUBJECTS.find((s) => s.key === slugify(nameOrId) || s.name.toLowerCase() === nameOrId.toLowerCase());
  if (special) return special;

  const known = [...players.map((p) => p.name), ...SPECIAL_SUBJECTS.map((s) => s.name)];
  throw new Error(`No subject matching "${nameOrId}". Known: ${known.join(", ")}`);
}

/** All 10 subjects (8 players + Cassandra + Bailey), for the boot-screen
 * group composite — the one asset that's supposed to include everyone. */
export async function allSubjects(): Promise<Subject[]> {
  const players = await fetchPlayers();
  return [...players.map((p) => ({ key: slugify(p.name), name: p.name, kind: "player" as const, player: p })), ...SPECIAL_SUBJECTS];
}
