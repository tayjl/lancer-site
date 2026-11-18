-- Biomods get a slot (where on the body: Arm, Eyes...), an effect (rules text, simple HTML like an item's effect in the
-- game data) and their own price. manna_cost was unused while every biomod cost a flat 500; it is now the real price.
-- Existing biomods are set to 500, so no pilot's manna balance changes; owners set the real prices in the editor.
alter table public.bionics add column slot text not null default '';
alter table public.bionics add column effect text not null default '';
update public.bionics set manna_cost = 500;

drop function public.save_bionic(text, text, integer, boolean, jsonb, bigint, timestamptz);

-- Same as before (all-or-nothing, owners only through the policies, stale saves refused), with the three new fields.
-- manna_cost and mod_point_cost keep their table checks (whole number, 0 or more).
create function public.save_bionic(
  new_name text,
  new_description text,
  new_slot text,
  new_effect text,
  new_price integer,
  new_mod_cost integer,
  new_retired boolean,
  new_bonuses jsonb,
  target_id bigint default null,
  expected_updated_at timestamptz default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  saved_id bigint;
  saved_at timestamptz;
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Only owners can change bionics.';
  end if;
  if length(btrim(coalesce(new_name, ''))) = 0 then
    raise exception 'A bionic needs a name.';
  end if;
  if jsonb_typeof(new_bonuses) is distinct from 'array'
    or exists (select 1 from jsonb_array_elements(new_bonuses) as b(item) where jsonb_typeof(item) is distinct from 'object'
               or jsonb_typeof(item->'stat_id') is distinct from 'string' or jsonb_typeof(item->'amount') is distinct from 'number')
    or (select count(distinct item->>'stat_id') from jsonb_array_elements(new_bonuses) as b(item)) <> jsonb_array_length(new_bonuses)
  then
    raise exception 'The bonuses must be a list with one amount per stat.';
  end if;

  if target_id is null then
    insert into public.bionics (name, description, slot, effect, manna_cost, mod_point_cost, retired)
    values (btrim(new_name), new_description, btrim(coalesce(new_slot, '')), coalesce(new_effect, ''), new_price, new_mod_cost, new_retired)
    returning id, updated_at into saved_id, saved_at;
  else
    update public.bionics set name = btrim(new_name), description = new_description, slot = btrim(coalesce(new_slot, '')),
      effect = coalesce(new_effect, ''), manna_cost = new_price, mod_point_cost = new_mod_cost, retired = new_retired
    where id = target_id and updated_at = expected_updated_at
    returning id, updated_at into saved_id, saved_at;
    if saved_id is null then
      raise exception 'This bionic changed somewhere else, or no longer exists.';
    end if;
    delete from public.bionic_bonuses where bionic_id = saved_id;
  end if;

  insert into public.bionic_bonuses (bionic_id, stat_id, amount)
    select saved_id, b.stat_id, b.amount from jsonb_to_recordset(new_bonuses) as b(stat_id text, amount integer);

  return jsonb_build_object('id', saved_id, 'updated_at', saved_at);
end;
$$;

revoke execute on function public.save_bionic(text, text, text, text, integer, integer, boolean, jsonb, bigint, timestamptz) from public, anon;
grant execute on function public.save_bionic(text, text, text, text, integer, integer, boolean, jsonb, bigint, timestamptz) to authenticated;
