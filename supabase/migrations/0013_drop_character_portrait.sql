-- character_portrait_url (0011) turned out unused: nothing in the app ever
-- read it — the /select roster strip uses photo_url directly, and
-- character_select_video_url covers the "hover" bust. Removing it rather
-- than leaving a dead upload field around.

alter table players drop column if exists character_portrait_url;
