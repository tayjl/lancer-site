-- 1. Where a pilot's banner image sits in its strip, 2. a public pilot ID card for link previews, and 3. a saved picture
-- of that card for Discord to show.

-- =====================================================================
-- 1. Banner position
-- =====================================================================

-- The banner is drawn with object-fit: cover. x and y are its object-position in percent, zoom scales it up from there.
-- The existing pilot_profiles policies already decide who may update the row (RLS works on whole rows).
alter table public.pilot_profiles
  add column if not exists banner_x real not null default 50 check (banner_x between 0 and 100),
  add column if not exists banner_y real not null default 50 check (banner_y between 0 and 100),
  add column if not exists banner_zoom real not null default 1 check (banner_zoom between 1 and 3);

-- A fingerprint of the card data last saved as a picture (section 3), set by the browser after the upload. Null: never saved.
alter table public.pilot_profiles
  add column if not exists card_version text check (char_length(card_version) <= 64);


-- =====================================================================
-- 2. The public pilot ID card
-- =====================================================================

-- What the pilot ID card shows (src/components/PilotIdCard.vue), readable without logging in so a link to
-- /registry/<id> can show a preview. Only approved and dead pilots: pending ones (drafts, submitted, sent back) give no
-- row, as does an unknown id. characters and character_sheets hold the approved pilot (open changes live in
-- pending_changes, which this never reads). Licence level is the licence ranks bought, like licenceLevel() in
-- src/rules.ts. colour is the stored colour, not displayColour()'s lightened one. medals are commendation icons in
-- award order. card_image is the storage path of the saved card picture (section 3), null until one is saved, and
-- card_version its fingerprint. Nothing else about the pilot is returned, and anon still has no access to any table.
create or replace function public.pilot_card(target_character_id bigint)
returns table (
  id bigint,
  callsign text,
  pilot_name text,
  status public.character_status,
  approved_at timestamptz,
  level integer,
  licence_level integer,
  pilot_image text,
  colour text,
  medals text[],
  card_image text,
  card_version text
)
language sql stable security definer set search_path = ''
as $$
  select
    c.id,
    c.callsign,
    c.pilot_name,
    c.status,
    c.approved_at,
    coalesce(s.level, 0),
    coalesce((
      select least(coalesce(sum(greatest(0, l.value::numeric)), 0), 2147483647) -- never overflows the integer cast
      from jsonb_each(case when jsonb_typeof(s.sheet -> 'licences') = 'object' then s.sheet -> 'licences' end) l
      where jsonb_typeof(l.value) = 'number'
    ), 0)::integer,
    c.pilot_image,
    p.colour,
    array(
      select m.icon
      from public.pilot_commendations a
      join public.commendations m on m.id = a.commendation_id
      where a.character_id = c.id
      order by a.awarded_at, a.id
    ),
    case when p.card_version is not null then c.player_id::text || '/card-' || c.id || '.png' end,
    p.card_version
  from public.characters c
  left join public.character_sheets s on s.character_id = c.id
  left join public.pilot_profiles p on p.character_id = c.id
  where c.id = target_character_id
    and c.status in ('approved', 'dead');
$$;

revoke all on function public.pilot_card(bigint) from public;
grant execute on function public.pilot_card(bigint) to anon, authenticated;


-- =====================================================================
-- 3. The saved card picture
-- =====================================================================

-- When the pilot's player or a GM views an approved or dead pilot and the card has changed, their browser draws the card
-- and uploads it to "<player id>/card-<character id>.png" in the public character-images bucket, overwriting the last one.
-- The player's own folder is already covered by "Users upload images into their own folder". Other uploads stay
-- immutable: the new policies only reach names of exactly this shape.
update storage.buckets
   set allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
 where id = 'character-images';

drop policy if exists "GMs upload card pictures anywhere" on storage.objects;
create policy "GMs upload card pictures anywhere"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'character-images'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/card-[0-9]+\.png$'
    and (select public.is_gm())
  );

-- Upserting also needs the existing "Logged-in users can see character images" select policy.
drop policy if exists "Users replace card pictures in their own folder; GMs anywhere" on storage.objects;
create policy "Users replace card pictures in their own folder; GMs anywhere"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'character-images'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/card-[0-9]+\.png$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_gm()))
  )
  with check (
    bucket_id = 'character-images'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/card-[0-9]+\.png$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_gm()))
  );
