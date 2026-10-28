-- Initial schema for the LANCER campaign site.
-- docs/database-sketch.md explains every table and rule in plain English.
-- Every table has Row Level Security (RLS) on, and logged-out visitors (anon) get no access at all.

create extension if not exists moddatetime schema extensions;
create schema if not exists private;


-- =====================================================================
-- 1. People and roles
-- =====================================================================

create type public.user_role as enum ('player', 'gm', 'owner');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.user_role not null default 'player',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create policy "Logged-in users can see every profile"
  on public.profiles for select to authenticated
  using (true);
-- No insert, update or delete through the site: the trigger below creates profiles,
-- and roles are changed by hand in the Supabase dashboard.

-- True when the logged-in user is a GM or an owner. Most rules below use it.
create function public.is_gm() returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('gm', 'owner')
  );
$$;

-- True when the logged-in user is an owner.
create function public.is_owner() returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'owner'
  );
$$;

-- Creates a player profile the first time someone logs in.
-- It runs as the database owner (security definer) because nobody can insert profiles through the site.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'Unknown pilot'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();


-- =====================================================================
-- 2. Characters: the public card and the private sheet
-- =====================================================================

create type public.character_status as enum ('pending', 'approved', 'dead');

create table public.characters (
  id bigint generated always as identity primary key,
  -- No "on delete cascade": deleting a user must not silently delete their characters.
  player_id uuid not null references public.profiles (id),
  status public.character_status not null default 'pending',
  pilot_name text not null,
  callsign text,
  age text,
  gender text,
  sexuality text,
  height text,
  weight text,
  eye_colour text,
  hair_colour text,
  appearance text,
  pilot_image text,
  personality text,
  traits text,
  -- Public info for each mech: id, name, appearance, image, manufacturer_id.
  mechs jsonb not null default '[]' check (jsonb_typeof(mechs) = 'array'),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  died_at timestamptz,
  updated_at timestamptz not null default now()
);

create index characters_player_id_idx on public.characters (player_id);

create trigger characters_updated_at
  before update on public.characters
  for each row execute procedure extensions.moddatetime (updated_at);

create table public.character_sheets (
  character_id bigint primary key references public.characters (id) on delete cascade,
  -- Everything the player can propose. docs/database-sketch.md shows the shape.
  sheet jsonb not null default '{}' check (jsonb_typeof(sheet) = 'object'),
  -- Not part of any pending change, so once a character is approved only GMs can change it.
  mod_points integer not null default 0 check (mod_points >= 0),
  review_note text,
  updated_at timestamptz not null default now()
);

create trigger character_sheets_updated_at
  before update on public.character_sheets
  for each row execute procedure extensions.moddatetime (updated_at);

alter table public.characters enable row level security;
alter table public.character_sheets enable row level security;
revoke all on public.characters, public.character_sheets from anon, authenticated;
grant select, insert, update, delete on public.characters to authenticated;
grant select, insert, update on public.character_sheets to authenticated;

create policy "Logged-in users can see every character card"
  on public.characters for select to authenticated
  using (true);

create policy "Players can create one pending character; GMs can create any"
  on public.characters for insert to authenticated
  with check (
    (select public.is_gm())
    or (
      player_id = (select auth.uid())
      and status = 'pending'
      and not exists (
        select 1 from public.characters existing
        where existing.player_id = (select auth.uid())
          and existing.status in ('pending', 'approved')
      )
    )
  );

-- "with check" stops a player from changing the status, so they can't approve themselves.
create policy "Players can edit their own character while it's pending"
  on public.characters for update to authenticated
  using (player_id = (select auth.uid()) and status = 'pending')
  with check (player_id = (select auth.uid()) and status = 'pending');

create policy "GMs can edit any character"
  on public.characters for update to authenticated
  using ((select public.is_gm()))
  with check ((select public.is_gm()));

create policy "Players can withdraw their own pending character; GMs can delete any"
  on public.characters for delete to authenticated
  using (
    (select public.is_gm())
    or (player_id = (select auth.uid()) and status = 'pending')
  );

create policy "Players see their own sheets; GMs see all"
  on public.character_sheets for select to authenticated
  using (
    (select public.is_gm())
    or exists (
      select 1 from public.characters c
      where c.id = character_sheets.character_id and c.player_id = (select auth.uid())
    )
  );

create policy "Players fill in their sheet while it's pending; GMs any time"
  on public.character_sheets for insert to authenticated
  with check (
    (select public.is_gm())
    or exists (
      select 1 from public.characters c
      where c.id = character_sheets.character_id
        and c.player_id = (select auth.uid())
        and c.status = 'pending'
    )
  );

create policy "Players edit their sheet while it's pending; GMs any time"
  on public.character_sheets for update to authenticated
  using (
    (select public.is_gm())
    or exists (
      select 1 from public.characters c
      where c.id = character_sheets.character_id
        and c.player_id = (select auth.uid())
        and c.status = 'pending'
    )
  )
  with check (
    (select public.is_gm())
    or exists (
      select 1 from public.characters c
      where c.id = character_sheets.character_id
        and c.player_id = (select auth.uid())
        and c.status = 'pending'
    )
  );


-- =====================================================================
-- 3. Pending changes to approved characters (and their history)
-- =====================================================================

create type public.change_status as enum ('pending', 'approved', 'rejected');

create table public.pending_changes (
  id bigint generated always as identity primary key,
  character_id bigint not null references public.characters (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id),
  -- The full public card as it should look after approval.
  proposed_public jsonb not null check (jsonb_typeof(proposed_public) = 'object'),
  -- The full sheet as it should look after approval.
  proposed_sheet jsonb not null check (jsonb_typeof(proposed_sheet) = 'object'),
  -- The character's updated_at when the player started editing. approve_change refuses
  -- if the character changed since, so a GM's direct edit isn't silently overwritten.
  -- shortcut: the site fills this in, so a player could fake it; the GM still sees the full difference. Set it in the database if that ever matters.
  based_on timestamptz not null,
  status public.change_status not null default 'pending',
  review_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rejection_needs_reason
    check (status <> 'rejected' or coalesce(review_reason, '') <> '')
);

create index pending_changes_character_id_idx on public.pending_changes (character_id);
create index pending_changes_submitted_by_idx on public.pending_changes (submitted_by);
create index pending_changes_reviewed_by_idx on public.pending_changes (reviewed_by);
-- At most one pending change per character.
create unique index pending_changes_one_pending_idx
  on public.pending_changes (character_id) where status = 'pending';

alter table public.pending_changes enable row level security;
revoke all on public.pending_changes from anon, authenticated;
grant select, insert, update, delete on public.pending_changes to authenticated;

create policy "Players see changes to their own characters; GMs see all"
  on public.pending_changes for select to authenticated
  using (
    (select public.is_gm())
    or exists (
      select 1 from public.characters c
      where c.id = pending_changes.character_id and c.player_id = (select auth.uid())
    )
  );

create policy "Players can propose changes to their own approved character"
  on public.pending_changes for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and exists (
      select 1 from public.characters c
      where c.id = pending_changes.character_id
        and c.player_id = (select auth.uid())
        and c.status = 'approved'
    )
  );

create policy "Players can edit their own change while it's pending"
  on public.pending_changes for update to authenticated
  using (submitted_by = (select auth.uid()) and status = 'pending')
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.characters c
      where c.id = pending_changes.character_id
        and c.player_id = (select auth.uid())
        and c.status = 'approved'
    )
  );

-- Approving only happens through approve_change(), never through a plain update.
create policy "GMs can reject a pending change"
  on public.pending_changes for update to authenticated
  using ((select public.is_gm()) and status = 'pending')
  with check ((select public.is_gm()) and status = 'rejected');

create policy "Players can withdraw their own pending change"
  on public.pending_changes for delete to authenticated
  using (submitted_by = (select auth.uid()) and status = 'pending');

-- Applies a pending change to its character, all-or-nothing. GMs and owners only.
-- It runs as the database owner (security definer) so it can mark the change approved,
-- which nobody can do with a plain update, so it checks the caller itself first.
create function public.approve_change(change_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  change public.pending_changes;
  last_changed timestamptz;
begin
  if not public.is_gm() then
    raise exception 'Only GMs and owners can approve changes.';
  end if;

  select * into change from public.pending_changes where id = change_id for update;
  if not found or change.status <> 'pending' then
    raise exception 'Change % is not waiting for review.', change_id;
  end if;

  -- Lock the character while it's checked and updated.
  select greatest(c.updated_at, s.updated_at) into last_changed
  from public.characters c
  left join public.character_sheets s on s.character_id = c.id
  where c.id = change.character_id
  for update of c;

  if last_changed > change.based_on then
    raise exception 'This character changed after the change was made. Reject it so the player can resubmit.';
  end if;

  -- Only these public columns can be changed by a pending change.
  update public.characters c
  set (pilot_name, callsign, age, gender, sexuality, height, weight, eye_colour, hair_colour,
       appearance, pilot_image, personality, traits, mechs)
    = (p.pilot_name, p.callsign, p.age, p.gender, p.sexuality, p.height, p.weight, p.eye_colour, p.hair_colour,
       p.appearance, p.pilot_image, p.personality, p.traits, p.mechs)
  from jsonb_populate_record(null::public.characters, change.proposed_public) p
  where c.id = change.character_id;

  insert into public.character_sheets (character_id, sheet)
  values (change.character_id, change.proposed_sheet)
  on conflict (character_id) do update set sheet = excluded.sheet;

  update public.pending_changes
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = change_id;
end;
$$;

-- Marks an approved character dead. Its player, a GM or an owner can do this, and it can't be undone.
-- It runs as the database owner because players can't update approved characters, so it checks the caller itself.
create function public.mark_dead(target_character_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.characters
  set status = 'dead', died_at = now()
  where id = target_character_id
    and status = 'approved'
    and (player_id = auth.uid() or public.is_gm());

  if not found then
    raise exception 'Character % is not an approved character you can mark dead.', target_character_id;
  end if;

  -- A dead character's waiting change can never be approved, so withdraw it.
  delete from public.pending_changes
  where character_id = target_character_id and status = 'pending';
end;
$$;

revoke execute on function public.approve_change(bigint), public.mark_dead(bigint) from public, anon;
grant execute on function public.approve_change(bigint), public.mark_dead(bigint) to authenticated;


-- =====================================================================
-- 4. Game content: LANCER packs, pilot stats and bionics
-- =====================================================================

create table public.content_packs (
  id bigint generated always as identity primary key,
  name text not null unique,
  version text,
  manifest jsonb not null,
  -- "Removing" a pack switches this off. Packs are never deleted, because characters may still use their items.
  enabled boolean not null default true,
  imported_by uuid references public.profiles (id) on delete set null,
  imported_at timestamptz not null default now()
);

create index content_packs_imported_by_idx on public.content_packs (imported_by);

create table public.content_items (
  -- The item's own LANCER/LCP ID, e.g. mf_blackbeard. Unique across all packs.
  id text primary key,
  pack_id bigint not null references public.content_packs (id),
  -- Which file the item came from: frames, weapons, systems, talents, core_bonuses, pilot_gear and so on.
  kind text not null,
  data jsonb not null
);

create index content_items_pack_id_idx on public.content_items (pack_id);
create index content_items_kind_idx on public.content_items (kind);

create table public.pilot_stats (
  -- Short key used in sheets and bonuses, e.g. tech_fluency. Rename the name, never the id.
  id text primary key,
  name text not null,
  sort_order integer not null default 0
);

insert into public.pilot_stats (id, name, sort_order) values
  ('physicality', 'Physicality', 1),
  ('dexterity', 'Dexterity', 2),
  ('perception', 'Perception', 3),
  ('acuity', 'Acuity', 4),
  ('tech_fluency', 'Tech-fluency', 5);

create table public.bionics (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  manna_cost integer not null default 0 check (manna_cost >= 0),
  mod_point_cost integer not null default 0 check (mod_point_cost >= 0),
  -- Used instead of deleting, because characters may still have it installed.
  retired boolean not null default false
);

create table public.bionic_bonuses (
  bionic_id bigint not null references public.bionics (id) on delete cascade,
  stat_id text not null references public.pilot_stats (id),
  amount integer not null,
  primary key (bionic_id, stat_id)
);

create index bionic_bonuses_stat_id_idx on public.bionic_bonuses (stat_id);

alter table public.content_packs enable row level security;
alter table public.content_items enable row level security;
alter table public.pilot_stats enable row level security;
alter table public.bionics enable row level security;
alter table public.bionic_bonuses enable row level security;
revoke all on public.content_packs, public.content_items, public.pilot_stats, public.bionics, public.bionic_bonuses
  from anon, authenticated;
-- No delete on the first four: items, stats and bionics are switched off or retired instead.
grant select, insert, update on public.content_packs, public.content_items, public.pilot_stats, public.bionics
  to authenticated;
grant select, insert, update, delete on public.bionic_bonuses to authenticated;

create policy "Logged-in users can see content packs" on public.content_packs for select to authenticated using (true);
create policy "Owners manage content packs" on public.content_packs for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "Logged-in users can see content items" on public.content_items for select to authenticated using (true);
create policy "Owners manage content items" on public.content_items for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "Logged-in users can see pilot stats" on public.pilot_stats for select to authenticated using (true);
create policy "Owners manage pilot stats" on public.pilot_stats for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- The catalogue is visible so players can choose. Which bionics a character has stays private in their sheet.
create policy "Logged-in users can see bionics" on public.bionics for select to authenticated using (true);
create policy "Owners manage bionics" on public.bionics for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "Logged-in users can see bionic bonuses" on public.bionic_bonuses for select to authenticated using (true);
create policy "Owners manage bionic bonuses" on public.bionic_bonuses for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));


-- =====================================================================
-- 5. Reputation (GMs and owners only)
-- =====================================================================

create table public.organisations (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text
);

create table public.reputation_levels (
  id bigint generated always as identity primary key,
  name text not null unique,
  -- Lowest to highest.
  sort_order integer not null default 0
);

create table public.reputation (
  character_id bigint not null references public.characters (id) on delete cascade,
  organisation_id bigint not null references public.organisations (id) on delete cascade,
  level_id bigint not null references public.reputation_levels (id),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (character_id, organisation_id)
);

create index reputation_organisation_id_idx on public.reputation (organisation_id);
create index reputation_level_id_idx on public.reputation (level_id);
create index reputation_updated_by_idx on public.reputation (updated_by);

create trigger reputation_updated_at
  before update on public.reputation
  for each row execute procedure extensions.moddatetime (updated_at);

alter table public.organisations enable row level security;
alter table public.reputation_levels enable row level security;
alter table public.reputation enable row level security;
revoke all on public.organisations, public.reputation_levels, public.reputation from anon, authenticated;
grant select, insert, update, delete on public.organisations, public.reputation_levels, public.reputation
  to authenticated;

create policy "GMs can see organisations" on public.organisations for select to authenticated
  using ((select public.is_gm()));
create policy "Owners manage organisations" on public.organisations for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "GMs can see reputation levels" on public.reputation_levels for select to authenticated
  using ((select public.is_gm()));
create policy "Owners manage reputation levels" on public.reputation_levels for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- Hidden from players, even for their own character.
create policy "GMs manage reputation" on public.reputation for all to authenticated
  using ((select public.is_gm())) with check ((select public.is_gm()));


-- =====================================================================
-- 6. Character images (Supabase Storage)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'character-images', 'character-images', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
);

-- Images go in a folder named after the uploader's user ID, e.g. "<user id>/pilot.png".
create policy "Logged-in users can see character images"
  on storage.objects for select to authenticated
  using (bucket_id = 'character-images');

create policy "Players manage images in their own folder; GMs anywhere"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'character-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_gm()))
  )
  with check (
    bucket_id = 'character-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_gm()))
  );
