#!/usr/bin/env node
/**
 * One-off, read-only snapshot of the whole Supabase project — every table's
 * rows as JSON, plus every file in the `photos` and `videos` storage
 * buckets — written to a timestamped folder under `backups/` (gitignored;
 * see `archive/` for the one snapshot that's deliberately committed).
 *
 * Why this exists: the free Supabase tier pauses a project after a stretch
 * of no API activity, and inactive free projects can eventually be deleted
 * outright. Pausing is reversible (a click in the dashboard resumes it),
 * but relying on that forever isn't a real preservation plan — this script
 * is the actual insurance: a copy of every result, bet, and clip that
 * doesn't depend on the Supabase project (or Vercel deployment) still
 * existing. `scripts/restore-supabase.mjs` is the other half — loads a
 * snapshot from either `backups/` or `archive/` back into a project.
 *
 * Uses the same public anon key the app itself ships with (this app's RLS
 * is deliberately wide-open to anon — see supabase/migrations/0002_rls.sql
 * and friends — there's no separate "admin" credential to reach for), read
 * from .env.local same as `next dev` does (point ENV_FILE at a different
 * file to back up a different project). Run once now, then move the
 * resulting `backups/<timestamp>/` folder somewhere durable (your own
 * cloud storage, an external drive) — don't leave it as the only copy on
 * this machine. That folder is for you; a snapshot meant to live in git as
 * this project's permanent record belongs under `archive/` instead (see
 * that folder's own README for the naming convention).
 *
 * Usage: node scripts/backup-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const TABLES = [
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
  "power_move",
  "app_settings",
];

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

async function backupTables(client, outDir) {
  const tablesDir = path.join(outDir, "tables");
  await mkdir(tablesDir, { recursive: true });
  for (const table of TABLES) {
    const { data, error } = await client.from(table).select("*");
    if (error) {
      console.warn(`skip ${table}: ${error.message}`);
      continue;
    }
    await writeFile(path.join(tablesDir, `${table}.json`), JSON.stringify(data, null, 2));
    console.log(`${table}: ${data?.length ?? 0} rows`);
  }
}

/** Recursively lists every object under `prefix` in `bucket` (Supabase
 * Storage's list() is one directory level at a time, folders included). */
async function listAllObjects(client, bucket, prefix = "") {
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  const files = [];
  for (const entry of data ?? []) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    // A folder placeholder entry has no `id`; recurse into it.
    if (entry.id === null) {
      files.push(...(await listAllObjects(client, bucket, fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function backupStorage(client, outDir) {
  for (const bucket of BUCKETS) {
    const files = await listAllObjects(client, bucket);
    console.log(`${bucket}: ${files.length} files`);
    for (const filePath of files) {
      const { data, error } = await client.storage.from(bucket).download(filePath);
      if (error) {
        console.warn(`skip ${bucket}/${filePath}: ${error.message}`);
        continue;
      }
      const destPath = path.join(outDir, "storage", bucket, filePath);
      await mkdir(path.dirname(destPath), { recursive: true });
      await writeFile(destPath, Buffer.from(await data.arrayBuffer()));
    }
  }
}

async function main() {
  const env = await loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join("backups", stamp);
  await mkdir(outDir, { recursive: true });

  console.log(`Backing up to ${outDir}/ ...`);
  await backupTables(client, outDir);
  await backupStorage(client, outDir);
  console.log(`Done. Move ${outDir}/ somewhere durable — it's your only copy outside Supabase.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
