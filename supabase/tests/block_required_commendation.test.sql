-- A commendation can't be deleted while an item or biomod requires it (migration 20261125200000). Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.commendations (id, name, icon) values
  ('dddddddd-0800-4000-9000-000000000001', 'Needed medal', 'star'),
  ('dddddddd-0800-4000-9000-000000000002', 'Free medal', 'star'),
  ('dddddddd-0800-4000-9000-000000000003', 'Edited medal', 'star'),
  ('dddddddd-0800-4000-9000-000000000004', 'Biomod medal', 'star');
insert into public.content_packs (id, name, manifest) overriding system value values (9801, '__BRC_PACK', '{}');
insert into public.content_items (id, pack_id, kind, data, edited) values
  ('__brc_a', 9801, 'pilot_gear', '{"name": "Ace pistol", "requires": [{"kind": "commendation", "id": "dddddddd-0800-4000-9000-000000000001"}]}', null),
  ('__brc_b', 9801, 'talents', '{"name": "Ace talent", "requires": [{"kind": "talent", "id": "x"}, {"kind": "commendation", "id": "dddddddd-0800-4000-9000-000000000001"}]}', null),
  -- The edited copy is what counts: data requires nothing, edited requires the medal.
  ('__brc_c', 9801, 'pilot_gear', '{"name": "Old kit"}', '{"name": "Edited kit", "requires": [{"kind": "commendation", "id": "dddddddd-0800-4000-9000-000000000003"}]}');
insert into public.bionics (name, requires)
  values ('Bio arm', '[{"kind": "commendation", "id": "dddddddd-0800-4000-9000-000000000004"}]');

select throws_ok($$ delete from public.commendations where id = 'dddddddd-0800-4000-9000-000000000001' $$, 'P0001',
  'Ace pistol and Ace talent require this commendation. Hide it instead.', 'a required commendation is refused, with the item names');
select throws_ok($$ delete from public.commendations where id = 'dddddddd-0800-4000-9000-000000000003' $$, 'P0001',
  'Edited kit requires this commendation. Hide it instead.', 'the edited copy counts');
select throws_ok($$ delete from public.commendations where id = 'dddddddd-0800-4000-9000-000000000004' $$, 'P0001',
  'Bio arm requires this commendation. Hide it instead.', 'a biomod requirement counts');
select lives_ok($$ delete from public.commendations where id = 'dddddddd-0800-4000-9000-000000000002' $$, 'an unused commendation is deleted');

delete from public.content_items where id in ('__brc_a', '__brc_b');
select lives_ok($$ delete from public.commendations where id = 'dddddddd-0800-4000-9000-000000000001' $$, 'deleted once nothing requires it');

select * from finish();
rollback;
