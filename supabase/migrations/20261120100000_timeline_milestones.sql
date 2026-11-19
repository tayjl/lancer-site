-- Automatic service-record entries ("auto" kind): the site writes a short, dated line when something notable happens to a
-- pilot. Nobody inserts "auto" rows directly (the table's policies refuse it); these security definer triggers do, with a
-- fixed search_path. Every entry uses today's date and has no body, except an award, whose reason is its body.

create function private.roman(n integer) returns text
language sql immutable set search_path = ''
as $$ select case n when 1 then 'I' when 2 then 'II' when 3 then 'III' else n::text end $$;

-- Approved for duty, Killed in action, and a new mech on an approved pilot's card.
create function private.milestones_from_card() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  mech jsonb;
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' and old.status = 'pending' then
      insert into public.pilot_timeline (character_id, kind, title) values (new.id, 'auto', 'Approved for duty');
    elsif new.status = 'dead' then
      insert into public.pilot_timeline (character_id, kind, title) values (new.id, 'auto', 'Killed in action');
    end if;
  end if;
  -- A pending pilot's mechs are covered by "Approved for duty".
  if old.status = 'approved' and new.status = 'approved'
     and jsonb_typeof(new.mechs) = 'array' and new.mechs is distinct from old.mechs then
    for mech in select value from jsonb_array_elements(new.mechs) loop
      if jsonb_typeof(mech) = 'object' and mech ->> 'id' is not null
         and not exists (
           select 1 from jsonb_array_elements(case when jsonb_typeof(old.mechs) = 'array' then old.mechs else '[]'::jsonb end) o
           where o ->> 'id' = mech ->> 'id'
         ) then
        insert into public.pilot_timeline (character_id, kind, title)
        values (new.id, 'auto', left('New mech: ' || coalesce(nullif(btrim(mech ->> 'name'), ''), 'Unnamed'), 100));
      end if;
    end loop;
  end if;
  return null;
end;
$$;

create trigger characters_milestones
  after update of status, mechs on public.characters
  for each row execute procedure private.milestones_from_card();

-- Reached level n, and a licence rank gained (an approved pilot's sheet only).
create function private.milestones_from_sheet() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  licence record;
  old_rank integer;
  frame_name text;
begin
  if not exists (select 1 from public.characters c where c.id = new.character_id and c.status = 'approved') then
    return null;
  end if;
  if new.level > old.level then
    insert into public.pilot_timeline (character_id, kind, title) values (new.character_id, 'auto', 'Reached level ' || new.level);
  end if;
  if jsonb_typeof(new.sheet -> 'licences') = 'object' then
    for licence in select key, value from jsonb_each(new.sheet -> 'licences') where jsonb_typeof(value) = 'number' loop
      old_rank := case when jsonb_typeof(old.sheet -> 'licences' -> licence.key) = 'number'
                       then (old.sheet -> 'licences' ->> licence.key)::numeric::integer else 0 end;
      if (licence.value)::text::numeric::integer > old_rank then
        select coalesce(i.edited ->> 'name', i.data ->> 'name') into frame_name from public.content_items i where i.id = licence.key;
        insert into public.pilot_timeline (character_id, kind, title)
        values (new.character_id, 'auto', left(coalesce(frame_name, licence.key) || ' licence, rank ' || private.roman((licence.value)::text::numeric::integer), 100));
      end if;
    end loop;
  end if;
  return null;
end;
$$;

create trigger character_sheets_milestones
  after update of level, sheet on public.character_sheets
  for each row execute procedure private.milestones_from_sheet();

-- Awarded a commendation: the reason (if any) is the entry's body, as one plain paragraph of rich text.
create function private.milestone_from_award() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  award_name text;
begin
  select c.name into award_name from public.commendations c where c.id = new.commendation_id;
  insert into public.pilot_timeline (character_id, kind, title, body)
  values (
    new.character_id, 'auto', left('Awarded ' || coalesce(award_name, 'a commendation'), 100),
    case when btrim(new.reason) = '' then null else jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', btrim(new.reason)))))
    ) end
  );
  return null;
end;
$$;

create trigger pilot_commendations_milestone
  after insert on public.pilot_commendations
  for each row execute procedure private.milestone_from_award();
