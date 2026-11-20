-- A public mech card for link previews, like the pilot ID card (20261120110000_banner_position_and_public_card.sql):
-- 1. where each mech card picture's version is kept, 2. the public mech card, and 3. the saved picture of it.

-- =====================================================================
-- 1. Mech card versions
-- =====================================================================

-- A fingerprint of each mech's card data last saved as a picture, by mech id (a lowercase UUID, from MechHangar.vue),
-- set by the browser after the upload. No key: never saved. Kept beside card_version so the same people write it (the
-- pilot's player while the pilot lives, GMs any time), and every logged-in user can already read the whole row: these
-- are fingerprints of public data only. Keys of mechs since removed are harmless: mech_card() only reads live mechs.
alter table public.pilot_profiles
  add column if not exists mech_card_versions jsonb not null default '{}'
    constraint pilot_profiles_mech_card_versions_valid check (
      jsonb_typeof(mech_card_versions) = 'object'
      and octet_length(mech_card_versions::text) <= 16384 -- about 140 mechs
      and not jsonb_path_exists(mech_card_versions,
        '$.keyvalue() ? (!(@.key like_regex "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
                         || @.value.type() != "string" || !(@.value like_regex "^.{0,64}$" flag "s"))')
    );


-- =====================================================================
-- 2. The public mech card
-- =====================================================================

-- What the mech card shows, readable without logging in so a link to a mech page can show a preview. Only mechs of
-- approved and dead pilots, read from characters (the public mech list) and the approved sheet (its frame id): an open
-- change in pending_changes is never read. A pending pilot, an unknown pilot or an unknown mech gives no row. The frame's
-- name and source (its manufacturer) come from published content, the campaign's edit over the original like loadKind()
-- in src/catalogue.ts. colour is the pilot's stored colour. card_image is the storage path of the saved card picture
-- (section 3), null until one is saved, and card_version its fingerprint. Nothing else from the sheet is returned.
create or replace function public.mech_card(target_character_id bigint, target_mech_id text)
returns table (
  character_id bigint,
  mech_id text,
  mech_name text,
  manufacturer_id text,
  mech_image text,
  frame_id text,
  frame_name text,
  frame_source text,
  callsign text,
  pilot_name text,
  status public.character_status,
  colour text,
  card_image text,
  card_version text
)
language sql stable security definer set search_path = ''
as $$
  select
    c.id,
    m.mech ->> 'id',
    m.mech ->> 'name',
    m.mech ->> 'manufacturer_id',
    m.mech ->> 'image',
    f.id,
    coalesce(f.edited, f.data) ->> 'name',
    coalesce(f.edited, f.data) ->> 'source',
    c.callsign,
    c.pilot_name,
    c.status,
    p.colour,
    case when p.mech_card_versions ? target_mech_id
      then c.player_id::text || '/mech-card-' || c.id || '-' || target_mech_id || '.png' end,
    p.mech_card_versions ->> target_mech_id
  from public.characters c
  cross join lateral (
    select e.mech
    from jsonb_array_elements(c.mechs) with ordinality e(mech, n) -- always a list (characters_mechs_check)
    where jsonb_typeof(e.mech) = 'object' and e.mech ->> 'id' = target_mech_id
    order by e.n
    limit 1
  ) m
  left join public.character_sheets s on s.character_id = c.id
  left join public.content_items f
    on f.kind = 'frames' and not f.draft
   and f.id = (case when jsonb_typeof(s.sheet -> 'mechs' -> target_mech_id) = 'object' then s.sheet -> 'mechs' -> target_mech_id ->> 'frame' end)
  left join public.pilot_profiles p on p.character_id = c.id
  where c.id = target_character_id
    and c.status in ('approved', 'dead');
$$;

revoke all on function public.mech_card(bigint, text) from public;
grant execute on function public.mech_card(bigint, text) to anon, authenticated;


-- =====================================================================
-- 3. The saved mech card picture
-- =====================================================================

-- Uploaded like the pilot card picture, to "<player id>/mech-card-<character id>-<mech id>.png". The two card picture
-- policies now reach both names, and still nothing else: other uploads stay immutable.
drop policy if exists "GMs upload card pictures anywhere" on storage.objects;
create policy "GMs upload card pictures anywhere"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'character-images'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(card-[0-9]+|mech-card-[0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.png$'
    and (select public.is_gm())
  );

drop policy if exists "Users replace card pictures in their own folder; GMs anywhere" on storage.objects;
create policy "Users replace card pictures in their own folder; GMs anywhere"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'character-images'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(card-[0-9]+|mech-card-[0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.png$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_gm()))
  )
  with check (
    bucket_id = 'character-images'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(card-[0-9]+|mech-card-[0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.png$'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_gm()))
  );
