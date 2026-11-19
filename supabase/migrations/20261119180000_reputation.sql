-- Reputation tracker (GM-only). The tables came with the initial schema; this adds the fixed levels and an updated_at
-- on factions (organisations), so the content editor can refuse a rename that would overwrite a newer one.
-- Players still can't read any of it: RLS on all three tables is GM or owner only.

alter table public.organisations add column if not exists updated_at timestamptz not null default now();

drop trigger if exists organisations_updated_at on public.organisations;
create trigger organisations_updated_at
  before update on public.organisations
  for each row execute procedure extensions.moddatetime (updated_at);

-- The five levels, lowest to highest. Not editable in the site (owners could still change them in the dashboard).
insert into public.reputation_levels (name, sort_order) values
  ('Hostile', 1), ('Unfriendly', 2), ('Neutral', 3), ('Friendly', 4), ('Allied', 5)
on conflict (name) do update set sort_order = excluded.sort_order;
