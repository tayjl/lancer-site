-- Owners delete a biomod, unless a pilot has it in their sheet or an open change. Same checks as delete_content_item.
-- Security definer because bionics has no delete grant. Its bionic_bonuses rows go with it (on delete cascade).
create function public.delete_bionic(target_id bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  users text[];
begin
  if not public.is_owner() then
    raise exception 'Only owners can delete content.';
  end if;

  -- Nobody can start using the biomod between the check and the delete.
  lock table public.character_sheets, public.pending_changes in share mode;

  select array_agg(u.pilot order by u.pilot) into users from public.item_usage(target_id::text, true) u;
  if users is not null then
    raise exception '% use% this biomod.',
      case when cardinality(users) = 1 then users[1]
           else array_to_string(users[1:cardinality(users) - 1], ', ') || ' and ' || users[cardinality(users)] end,
      case when cardinality(users) = 1 then 's' else '' end;
  end if;

  delete from public.bionics where id = target_id;
end;
$$;

revoke execute on function public.delete_bionic(bigint) from public, anon;
grant execute on function public.delete_bionic(bigint) to authenticated;
