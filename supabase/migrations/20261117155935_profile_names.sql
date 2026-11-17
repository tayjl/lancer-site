-- A Discord account with no display name sends it as an empty string, not as missing, so coalesce() took the
-- empty string and the player showed with a blank name. Empty or blank names now fall through to the next one
-- (display name, then username, then name), and profiles that already got a blank name are filled in.

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, private.discord_name(new.raw_user_meta_data));
  return new;
end;
$$;

-- The first non-blank name Discord sent, or 'Unknown pilot'.
create function private.discord_name(meta jsonb) returns text
language sql immutable set search_path = ''
as $$
  select coalesce(
    nullif(btrim(meta -> 'custom_claims' ->> 'global_name'), ''),
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    'Unknown pilot'
  );
$$;

revoke execute on function private.discord_name(jsonb) from public;

update public.profiles p
set display_name = private.discord_name(u.raw_user_meta_data)
from auth.users u
where u.id = p.id and btrim(p.display_name) = '';
