#!/usr/bin/env node
/**
 * Restores a snapshot captured by scripts/backup-supabase.mjs — either a
 * fresh local run (`backups/<date>/`) or one committed to the repo
 * (`archive/<date>-weekend-results/`) — into a Supabase project.
 *
 * Meant for reviving this app on a brand-new project once the original one
 * has been paused/deleted: run every migration in supabase/migrations/ (in
 * order, via the Supabase SQL editor or `supabase db push`) FIRST, so the
 * schema and the two singleton rows (app_settings, power_move) already
 * exist, then run this.
 *
 * Inserts rows in FK-dependency order and upserts the singleton tables
 * (app_settings, power_move — the migrations create their one row with
 * `id = 1` already). Re-uploads every file into the photos/videos buckets
 * at its original path.
 *
 * Usage: node scripts/restore-supabase.mjs archive/2026-08-31-weekend-results
 *   (reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from
 *   .env.local by default — point ENV_FILE at a different file to target a
 *   different project.)
 */
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "fs/promises";
import path from "path";

// Parents before children, so foreign keys resolve as each table loads.
const TABLE_ORDER = [
  "players",
  "events",
  "event_results",
  "multipliers",
  "event_rankings",
  "overall_bets",
  "per_event_bets",
  "bonus_events",
  "bracket_seeds",
  "bracket_matches",
  "round_robin_matches",
  "placement_rounds",
];
const SINGLETON_TABLES = ["power_move", "app_settings"];
const BUCKETS = ["photos", "videos"];

async function loadEnv() {
  const raw = await readFile(process.env.ENV_FILE ?? ".env.local", "utf8");
  return Object.fromEntries(
    raw
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

async function restoreTables(client, dir) {
  for (const table of [...TABLE_ORDER, ...SINGLETON_TABLES]) {
    let rows;
    try {
      rows = JSON.parse(await readFile(path.join(dir, "tables", `${table}.json`), "utf8"));
    } catch {
      console.warn(`skip ${table}: no snapshot file`);
      continue;
    }
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const op = SINGLETON_TABLES.includes(table) ? "upsert" : "insert";
    const { error } = await client.from(table)[op](rows);
    if (error) throw new Error(`${op} ${table}: ${error.message}`);
    console.log(`${table}: restored ${rows.length} rows`);
  }
}

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function restoreStorage(client, dir) {
  for (const bucket of BUCKETS) {
    const root = path.join(dir, "storage", bucket);
    const files = await walk(root);
    for (const filePath of files) {
      const objectPath = path.relative(root, filePath);
      const body = await readFile(filePath);
      const { error } = await client.storage
        .from(bucket)
        .upload(objectPath, body, { upsert: true });
      if (error) console.warn(`skip ${bucket}/${objectPath}: ${error.message}`);
    }
    console.log(`${bucket}: restored ${files.length} files`);
  }
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    throw new Error("Usage: node scripts/restore-supabase.mjs <snapshot-dir>");
  }
  const env = await loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  console.log(`Restoring ${dir} -> ${env.NEXT_PUBLIC_SUPABASE_URL} ...`);
  await restoreTables(client, dir);
  await restoreStorage(client, dir);
  console.log("Restore complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
