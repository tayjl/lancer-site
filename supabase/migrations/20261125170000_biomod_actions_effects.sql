-- Biomods, phase 1 (content editor step 8): actions get a column, and the personal-stat bonuses move from
-- bionic_bonuses into effect_bonuses ({"id": stat_id, "val": amount}), so a biomod has one effect list like every
-- other kind. bionic_bonuses stays for now: the live site still selects it until the new site is deployed (a later
-- migration drops it). The copy bumps updated_at (moddatetime), which is a real change, so an open editor gets the usual
-- "changed somewhere else" refusal. A biomod with more than 50 combined entries would fail the effect_bonuses check and stop the migration loudly.

alter table public.bionics
  add column actions jsonb not null default '[]'
    check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) <= 50);

update public.bionics b set effect_bonuses = b.effect_bonuses || (
  select coalesce(jsonb_agg(jsonb_build_object('id', bb.stat_id, 'val', bb.amount) order by bb.stat_id), '[]')
  from public.bionic_bonuses bb where bb.bionic_id = b.id)
where exists (select 1 from public.bionic_bonuses bb where bb.bionic_id = b.id);

drop function public.save_bionic(text, text, text, text, integer, integer, boolean, jsonb, bigint, timestamptz, text, jsonb, text[], text[], boolean, jsonb);

-- Same as 20261121140000 without new_bonuses (stat bonuses are effect bonuses now), with new_actions as the last argument.
create function public.save_bionic(
  new_name text,
  new_description text,
  new_slot text,
  new_effect text,
  new_price integer,
  new_mod_cost integer,
  new_retired boolean,
  target_id bigint default null,
  expected_updated_at timestamptz default null,
  new_source text default null,
  new_effect_bonuses jsonb default '[]',
  new_integrated text[] default '{}',
  new_special_equipment text[] default '{}',
  new_replace_integrated boolean default false,
  new_requires jsonb default '[]',
  new_actions jsonb default '[]'
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  saved_id bigint;
  saved_at timestamptz;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Only owners can change biomods.';
  end if;
  if length(btrim(coalesce(new_name, ''))) = 0 then
    raise exception 'A biomod needs a name.';
  end if;
  if jsonb_typeof(new_effect_bonuses) is distinct from 'array'
    or exists (select 1 from jsonb_array_elements(new_effect_bonuses) as b(item) where jsonb_typeof(item) is distinct from 'object'
               or jsonb_typeof(item->'id') is distinct from 'string')
  then
    raise exception 'The effect bonuses must be a list of bonuses.';
  end if;
  if jsonb_typeof(new_requires) is distinct from 'array'
    or exists (select 1 from jsonb_array_elements(new_requires) as r(item) where jsonb_typeof(item) is distinct from 'object')
  then
    raise exception 'The requirements must be a list.';
  end if;
  if jsonb_typeof(new_actions) is distinct from 'array'
    or exists (select 1 from jsonb_array_elements(new_actions) as a(item) where jsonb_typeof(item) is distinct from 'object')
  then
    raise exception 'The actions must be a list.';
  end if;

  if target_id is null then
    insert into public.bionics (name, description, slot, effect, manna_cost, mod_point_cost, retired, source,
      effect_bonuses, integrated, special_equipment, replace_integrated, requires, actions)
    values (btrim(new_name), new_description, btrim(coalesce(new_slot, '')), coalesce(new_effect, ''), new_price, new_mod_cost, new_retired, nullif(btrim(coalesce(new_source, '')), ''),
      new_effect_bonuses, coalesce(new_integrated, '{}'), coalesce(new_special_equipment, '{}'), coalesce(new_replace_integrated, false), new_requires, new_actions)
    returning id, updated_at into saved_id, saved_at;
  else
    update public.bionics set name = btrim(new_name), description = new_description, slot = btrim(coalesce(new_slot, '')),
      effect = coalesce(new_effect, ''), manna_cost = new_price, mod_point_cost = new_mod_cost, retired = new_retired,
      source = nullif(btrim(coalesce(new_source, '')), ''), effect_bonuses = new_effect_bonuses,
      integrated = coalesce(new_integrated, '{}'), special_equipment = coalesce(new_special_equipment, '{}'),
      replace_integrated = coalesce(new_replace_integrated, false), requires = new_requires, actions = new_actions
    where id = target_id and updated_at = expected_updated_at
    returning id, updated_at into saved_id, saved_at;
    if saved_id is null then
      raise exception 'This biomod changed somewhere else, or no longer exists.';
    end if;
  end if;

  return jsonb_build_object('id', saved_id, 'updated_at', saved_at);
end;
$$;

revoke execute on function public.save_bionic(text, text, text, text, integer, integer, boolean, bigint, timestamptz, text, jsonb, text[], text[], boolean, jsonb, jsonb) from public, anon;
grant execute on function public.save_bionic(text, text, text, text, integer, integer, boolean, bigint, timestamptz, text, jsonb, text[], text[], boolean, jsonb, jsonb) to authenticated;
