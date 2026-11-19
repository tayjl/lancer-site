-- Player customisation of a pilot's profile, and the tables for a service record and commendations.
--
-- Everything here is cosmetic and public to every logged-in user, and saves live with no GM approval, even on approved
-- pilots. Game parts (stats, gear, licences, mechs) still go through pending changes. A pilot's own player may edit
-- their pilot's rows unless the pilot is dead; GMs and owners (is_gm() is true for both) may edit any.
-- Images are uploads in the existing "character-images" bucket (its policies already let a user upload into their own
-- folder and delete from it, GMs anywhere): the tables store the path, never a URL, in the same shape as
-- characters.pilot_image.

-- =====================================================================
-- 1. The profile: colour, motto, banner and gallery
-- =====================================================================

create table public.pilot_profiles (
  character_id bigint primary key references public.characters (id) on delete cascade,
  -- Plain #rrggbb. The site lightens a too-dark colour when it draws it.
  colour text check (colour ~ '^#[0-9a-fA-F]{6}$'),
  motto text check (char_length(motto) <= 120),
  banner_image text check (
    banner_image ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
  ),
  -- At most 4 pictures: [{ "path": "<upload path>", "caption": "…" }]. Checked by the trigger below.
  gallery jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create trigger pilot_profiles_updated_at
  before update on public.pilot_profiles
  for each row execute procedure extensions.moddatetime (updated_at);

-- A check constraint can't look inside the array's items without a function, so a trigger does it: an array of at most 4
-- objects, each with an upload path and a caption (text, 140 characters at most, may be missing).
create function private.check_pilot_gallery() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if jsonb_typeof(new.gallery) is distinct from 'array' or jsonb_array_length(new.gallery) > 4 then
    raise exception 'A gallery holds at most 4 pictures.' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.gallery) item
    where jsonb_typeof(item) <> 'object'
       or jsonb_typeof(item -> 'path') is distinct from 'string'
       or (item ->> 'path') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
       or (item -> 'caption' is not null and jsonb_typeof(item -> 'caption') <> 'string')
       or char_length(coalesce(item ->> 'caption', '')) > 140
  ) then
    raise exception 'Each gallery picture needs an uploaded image and a caption of 140 characters or fewer.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pilot_profiles_check_gallery
  before insert or update on public.pilot_profiles
  for each row execute procedure private.check_pilot_gallery();

alter table public.pilot_profiles enable row level security;
revoke all on public.pilot_profiles from anon, authenticated;
grant select, insert, update, delete on public.pilot_profiles to authenticated;

create policy "Everyone logged in can read profiles" on public.pilot_profiles
  for select to authenticated using (true);

create policy "Players add the profile of their own living pilot" on public.pilot_profiles
  for insert to authenticated
  with check (
    exists (
      select 1 from public.characters c
      where c.id = pilot_profiles.character_id and c.player_id = (select auth.uid()) and c.status <> 'dead'
    )
  );

create policy "Players edit the profile of their own living pilot" on public.pilot_profiles
  for update to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = pilot_profiles.character_id and c.player_id = (select auth.uid()) and c.status <> 'dead'
    )
  )
  with check (
    exists (
      select 1 from public.characters c
      where c.id = pilot_profiles.character_id and c.player_id = (select auth.uid()) and c.status <> 'dead'
    )
  );

create policy "GMs add any profile" on public.pilot_profiles
  for insert to authenticated with check ((select public.is_gm()));
create policy "GMs edit any profile" on public.pilot_profiles
  for update to authenticated using ((select public.is_gm())) with check ((select public.is_gm()));
create policy "GMs delete any profile" on public.pilot_profiles
  for delete to authenticated using ((select public.is_gm()));


-- =====================================================================
-- 2. Service record (the wave 2 timeline)
-- =====================================================================

create table public.pilot_timeline (
  id uuid primary key default gen_random_uuid(),
  character_id bigint not null references public.characters (id) on delete cascade,
  -- player: written by the pilot's player. gm: written by a GM. auto: made by the site (triggers or definer functions only).
  kind text not null check (kind in ('player', 'gm', 'auto')),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  -- Formatted text in the same JSON format as lore bodies (TipTap's).
  body jsonb check (jsonb_typeof(body) = 'object'),
  occurred_on date not null default current_date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pilot_timeline_character_idx on public.pilot_timeline (character_id, occurred_on desc);
create index pilot_timeline_created_by_idx on public.pilot_timeline (created_by);

create trigger pilot_timeline_updated_at
  before update on public.pilot_timeline
  for each row execute procedure extensions.moddatetime (updated_at);

-- Who wrote an entry can't be forged, and an entry never moves to another pilot or changes kind.
create function private.keep_timeline_origin() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.character_id := old.character_id;
    new.kind := old.kind;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger pilot_timeline_keep_origin
  before insert or update on public.pilot_timeline
  for each row execute procedure private.keep_timeline_origin();

alter table public.pilot_timeline enable row level security;
revoke all on public.pilot_timeline from anon, authenticated;
grant select, insert, update, delete on public.pilot_timeline to authenticated;

create policy "Everyone logged in can read the service record" on public.pilot_timeline
  for select to authenticated using (true);

-- Players: their own "player" entries, on a living pilot they own. Nobody inserts "auto" entries directly.
create policy "Players add entries to their own pilot" on public.pilot_timeline
  for insert to authenticated
  with check (
    kind = 'player'
    and exists (
      select 1 from public.characters c
      where c.id = pilot_timeline.character_id and c.player_id = (select auth.uid()) and c.status <> 'dead'
    )
  );

create policy "Players edit their own entries" on public.pilot_timeline
  for update to authenticated
  using (
    kind = 'player'
    and exists (
      select 1 from public.characters c
      where c.id = pilot_timeline.character_id and c.player_id = (select auth.uid()) and c.status <> 'dead'
    )
  )
  with check (
    kind = 'player'
    and exists (
      select 1 from public.characters c
      where c.id = pilot_timeline.character_id and c.player_id = (select auth.uid()) and c.status <> 'dead'
    )
  );

create policy "Players delete their own entries" on public.pilot_timeline
  for delete to authenticated
  using (
    kind = 'player'
    and exists (
      select 1 from public.characters c
      where c.id = pilot_timeline.character_id and c.player_id = (select auth.uid()) and c.status <> 'dead'
    )
  );

-- GMs: "gm" entries anywhere, and they can delete any entry.
create policy "GMs add gm entries" on public.pilot_timeline
  for insert to authenticated with check (kind = 'gm' and (select public.is_gm()));
create policy "GMs edit gm entries" on public.pilot_timeline
  for update to authenticated using (kind = 'gm' and (select public.is_gm())) with check (kind = 'gm' and (select public.is_gm()));
create policy "GMs delete any entry" on public.pilot_timeline
  for delete to authenticated using ((select public.is_gm()));


-- =====================================================================
-- 3. Commendations: awards GMs give pilots
-- =====================================================================

create table public.commendations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  -- A name from the site's icon set (src/assets/icons).
  icon text not null check (icon ~ '^[a-z0-9-]+$'),
  updated_at timestamptz not null default now()
);

create trigger commendations_updated_at
  before update on public.commendations
  for each row execute procedure extensions.moddatetime (updated_at);

alter table public.commendations enable row level security;
revoke all on public.commendations from anon, authenticated;
grant select, insert, update, delete on public.commendations to authenticated;

create policy "Everyone logged in can read commendations" on public.commendations
  for select to authenticated using (true);
create policy "Owners add commendations" on public.commendations
  for insert to authenticated with check ((select public.is_owner()));
create policy "Owners edit commendations" on public.commendations
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "Owners delete commendations" on public.commendations
  for delete to authenticated using ((select public.is_owner()));

create table public.pilot_commendations (
  id uuid primary key default gen_random_uuid(),
  character_id bigint not null references public.characters (id) on delete cascade,
  commendation_id uuid not null references public.commendations (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  awarded_by uuid references public.profiles (id) on delete set null default auth.uid(),
  awarded_at timestamptz not null default now()
);

create index pilot_commendations_character_idx on public.pilot_commendations (character_id);
create index pilot_commendations_commendation_idx on public.pilot_commendations (commendation_id);
create index pilot_commendations_awarded_by_idx on public.pilot_commendations (awarded_by);

-- Who gave an award can't be forged.
create function private.keep_award_giver() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.awarded_by := auth.uid();
  return new;
end;
$$;

create trigger pilot_commendations_keep_giver
  before insert on public.pilot_commendations
  for each row execute procedure private.keep_award_giver();

alter table public.pilot_commendations enable row level security;
revoke all on public.pilot_commendations from anon, authenticated;
grant select, insert, delete on public.pilot_commendations to authenticated;

create policy "Everyone logged in can read awards" on public.pilot_commendations
  for select to authenticated using (true);
create policy "GMs give awards" on public.pilot_commendations
  for insert to authenticated with check ((select public.is_gm()));
create policy "GMs take awards back" on public.pilot_commendations
  for delete to authenticated using ((select public.is_gm()));
