-- Add groom_ranking to the Realtime publication.
--
-- 0003_realtime.sql added every game table to supabase_realtime except this
-- one — an oversight caught while building the groom's odds-ranking screen.
-- Without this, every device's odds view would need a manual refresh to see
-- a new ranking instead of updating live like the rest of the app.

alter publication supabase_realtime add table groom_ranking;
