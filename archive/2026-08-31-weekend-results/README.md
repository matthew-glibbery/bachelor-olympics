# Weekend results — snapshot taken 2026-08-31

A full export of the live Supabase project for this weekend's competition,
captured via `scripts/backup-supabase.mjs` right after activity stopped, so
the results survive regardless of what happens to the hosted project later
(the free Supabase tier pauses inactive projects, and can eventually delete
one outright — see that script's own doc comment).

**7 players, 8 events, 42 event results, 46 multiplier allocations, 13
overall bets, 26 per-event bets, 8 bonus events** (includes weekend
awards), plus every photo and character clip that had been uploaded.

## What's in here

```
tables/        every table's rows, one JSON file per table
storage/photos/    player photos + event photos, at their original storage path
storage/videos/    fullbody/victory clips + the boot video, at their original storage path
```

This is exactly the shape `scripts/backup-supabase.mjs` produces and
`scripts/restore-supabase.mjs` expects — nothing here has been edited by
hand.

## Reloading this into a Supabase project

1. Create a fresh Supabase project (or use one that's just had every
   migration applied and is otherwise empty).
2. Run every migration in `supabase/migrations/` in order (SQL editor, or
   `supabase db push`) — this creates the schema and the two singleton rows
   (`app_settings`, `power_move`) that the restore script upserts into
   rather than inserts.
3. Point `.env.local` (or `ENV_FILE`) at that project, then:
   ```
   node scripts/restore-supabase.mjs archive/2026-08-31-weekend-results
   ```

See `scripts/restore-supabase.mjs`'s own doc comment for what it actually
does (insert order, singleton handling, storage re-upload).
