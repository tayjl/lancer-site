-- Content editor step 4c: what src/itemDetails.ts hard-coded about gear and tags moves into data flags.
-- A. gear_types data flag pilotCard: the type gets the pilot card look (Weapon deliberately has none).
-- B. tags flag hideOnCard: the tag is not shown on item cards. Tags are content_items rows (kind 'tags') that come from
--    an LCP import (the local seed copies them), so on a database without them this changes nothing. The flag goes in
--    edited, not data: import_lcp only writes data, so a pack re-import keeps it, same as editor changes. The site reads
--    edited ?? data, so the row's pack data is copied into edited first. (updated_at moves by trigger; content_saves
--    is left alone, as for imports.)
-- C. The label of the two 'Armor' rows is 'Armour'. Ids stay 'Armor' because items store the id.

update public.game_definitions set data = data || '{"pilotCard": true}' where kind = 'gear_types' and id = 'Armor';
update public.game_definitions set data = data || '{"pilotCard": true}' where kind = 'gear_types' and id = 'Gear';

update public.content_items set edited = coalesce(edited, data) || '{"hideOnCard": true}'
where kind = 'tags' and id in ('tg_gear', 'tg_pilot_weapon', 'tg_personal_armor');

update public.game_definitions set label = 'Armour' where kind = 'gear_types' and id = 'Armor' and label = 'Armor';
update public.game_definitions set label = 'Armour' where kind = 'system_types' and id = 'Armor' and label = 'Armor';
