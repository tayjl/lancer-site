-- Faction names are 1 to 60 characters, like commendations (FACTION_NAME_MAX in src).
-- Hosted check first: select id, name from public.organisations where char_length(btrim(name)) not between 1 and 60;
-- The constraint is checked against every existing row, so the migration fails if one is out of range.
alter table public.organisations
  add constraint organisations_name_length check (char_length(btrim(name)) between 1 and 60);
