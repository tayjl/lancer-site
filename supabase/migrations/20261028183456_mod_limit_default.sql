-- The mod limit (mod_points) starts at 6 for every pilot. GMs can still raise it.
alter table public.character_sheets alter column mod_points set default 6;

-- Pilots still waiting for approval were created with the old default of 0, which nobody chose on purpose.
update public.character_sheets s
set mod_points = 6
from public.characters c
where c.id = s.character_id and c.status = 'pending' and s.mod_points = 0;
