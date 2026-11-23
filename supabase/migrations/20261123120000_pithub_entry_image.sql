-- One optional picture per pithub entry: a path in the 'character-images' bucket, same shape as characters.pilot_image.
-- Existing table policies and grants already cover the new column. GMs upload into their own folder like everyone else.
alter table public.pithub_entries add column image text;

alter table public.pithub_entries
  add constraint pithub_entries_image_is_upload check (
    image is null
    or image ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
  );
