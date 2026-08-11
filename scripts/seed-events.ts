/**
 * One-off / idempotent seed: pushes the event roster from
 * src/lib/events/config.ts into the live `events` table (upsert by id, never
 * touches `status`). Run with: npm run seed:events
 */
import { createClient } from "@supabase/supabase-js";
import { seedEvents } from "../src/lib/data/queries";

process.loadEnvFile?.(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
}

const client = createClient(url, key);

seedEvents(client).then(() => {
  console.log("Events seeded.");
});
