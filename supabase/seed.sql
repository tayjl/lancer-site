-- Local development only: `supabase db reset` runs this on the local database. The hosted project never
-- runs it (we don't use Supabase preview branches), so these accounts don't exist there.
-- Discord login only works on the hosted site, so this gives a password login for testing locally.
--   email: test-pilot@hor-os.local   password: local-test-pilot   (role: player)

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'test-pilot@hor-os.local', extensions.crypt('local-test-pilot', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', '{"full_name": "Test Pilot"}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
  '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "email": "test-pilot@hor-os.local"}',
  'email', now(), now(), now()
);
