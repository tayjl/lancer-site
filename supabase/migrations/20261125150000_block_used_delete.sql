-- A faction or commendation can't be deleted while pilots have it: hide it instead. Triggers, so the dashboard and
-- the editor's direct delete are covered too. The foreign keys stay: deleting a pilot still removes their own rows.
create function private.block_used_faction() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  users text[];
begin
  select array_agg(n order by n) into users from (
    select distinct coalesce(nullif(btrim(c.callsign), ''), nullif(btrim(c.pilot_name), ''), 'Unnamed pilot') as n
    from public.reputation r join public.characters c on c.id = r.character_id
    where r.organisation_id = old.id
  ) x;
  if users is not null then
    raise exception '% ha% a reputation with this faction. Hide it instead.',
      case when cardinality(users) = 1 then users[1]
           else array_to_string(users[1:cardinality(users) - 1], ', ') || ' and ' || users[cardinality(users)] end,
      case when cardinality(users) = 1 then 's' else 've' end;
  end if;
  return old;
end;
$$;

create function private.block_used_commendation() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  users text[];
begin
  select array_agg(n order by n) into users from (
    select distinct coalesce(nullif(btrim(c.callsign), ''), nullif(btrim(c.pilot_name), ''), 'Unnamed pilot') as n
    from public.pilot_commendations pc join public.characters c on c.id = pc.character_id
    where pc.commendation_id = old.id
  ) x;
  if users is not null then
    raise exception '% ha% this commendation. Hide it instead.',
      case when cardinality(users) = 1 then users[1]
           else array_to_string(users[1:cardinality(users) - 1], ', ') || ' and ' || users[cardinality(users)] end,
      case when cardinality(users) = 1 then 's' else 've' end;
  end if;
  return old;
end;
$$;

revoke execute on function private.block_used_faction() from public, anon, authenticated;
revoke execute on function private.block_used_commendation() from public, anon, authenticated;

create trigger organisations_block_used before delete on public.organisations
  for each row execute procedure private.block_used_faction();
create trigger commendations_block_used before delete on public.commendations
  for each row execute procedure private.block_used_commendation();
