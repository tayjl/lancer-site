-- Image uploads for pilot portraits and mech images.
--
-- The site shrinks each image in the browser and uploads it to "<user id>/<random id>.webp" (or ".jpg"). The card
-- stores that path, never a URL, and the page builds the public link itself, so a tampered value can't point
-- anyone's browser at an outside site. Images are public to read (pending pilots' public cards are visible to every
-- logged-in user anyway) and immutable: every upload is a new file, so there is no update policy.

-- Uploads never existed before, so any value already in the column is not a real image.
update public.characters
   set pilot_image = null
 where pilot_image is not null
   and pilot_image !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$';

alter table public.characters
  add constraint characters_pilot_image_is_upload check (
    pilot_image is null
    or pilot_image ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
  );

-- Public read, 1 MB, and only the two formats the browser produces.
update storage.buckets
   set public = true,
       file_size_limit = 1048576,
       allowed_mime_types = array['image/webp', 'image/jpeg']
 where id = 'character-images';

-- The old policy let a user do anything (including overwrite) in their folder.
drop policy "Players manage images in their own folder; GMs anywhere" on storage.objects;

create policy "Users upload images into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'character-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Deleting needs the existing "Logged-in users can see character images" select policy too: the storage API reads the row first.
create policy "Users delete images in their own folder; GMs anywhere"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'character-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_gm()))
  );
