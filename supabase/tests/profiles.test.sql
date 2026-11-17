-- The name a new player's profile gets from Discord. Run with: supabase test db (rolled back, nothing kept).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'display@test.local', '{"custom_claims": {"global_name": "Shown Name"}, "full_name": "username"}'),
  ('a2222222-2222-2222-2222-222222222222', 'blank@test.local', '{"custom_claims": {"global_name": ""}, "full_name": "minty"}'),
  ('a3333333-3333-3333-3333-333333333333', 'spaces@test.local', '{"custom_claims": {"global_name": "  "}, "full_name": " ", "name": "fallback"}'),
  ('a4444444-4444-4444-4444-444444444444', 'none@test.local', '{}');

select is((select display_name from public.profiles where id = 'a1111111-1111-1111-1111-111111111111'), 'Shown Name', 'the Discord display name comes first');
select is((select display_name from public.profiles where id = 'a2222222-2222-2222-2222-222222222222'), 'minty', 'an empty display name falls back to the username');
select is((select display_name from public.profiles where id = 'a3333333-3333-3333-3333-333333333333'), 'fallback', 'blank names are skipped too');
select is((select display_name from public.profiles where id = 'a4444444-4444-4444-4444-444444444444'), 'Unknown pilot', 'no name at all gives Unknown pilot');

select * from finish();
rollback;
