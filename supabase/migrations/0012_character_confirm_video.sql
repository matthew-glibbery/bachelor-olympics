-- Fifth character-media slot: the "you're playing as ___" confirm clip that
-- plays once on /select right after hitting "Let's go", before routing into
-- the app — distinct from character_fullbody_video_url (the idling render
-- while still choosing). See docs/VISUAL_SPEC.md.

alter table players add column if not exists character_confirm_video_url text;
