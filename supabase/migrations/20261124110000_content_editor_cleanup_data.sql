-- Content editor cleanup, phase 2 (data half): the stored seed rows follow the new seed in src/rulesData.ts and src/baseActions.ts.
-- Safe to run twice. Where the owner has edited a row ('edited' is set) the owner's text is left alone and only 'data' (the original) is updated.

-- 1. A tag's own flag replaces the 'Tags card' list rows (a row's name is a tag id). Read the live rows, so the owner's changes carry over.
update public.content_items t
set data = jsonb_set(t.data, '{combat_page}', 'true'),
    edited = case when t.edited is null then null else jsonb_set(t.edited, '{combat_page}', 'true') end
where t.kind = 'tags'
  and t.id in (select coalesce(r.edited, r.data) ->> 'name' from public.content_items r where r.kind = 'rules' and r.id like 'rule\_tag\_list\_%');

delete from public.content_items where kind = 'rules' and (id like 'rule\_tag\_list\_%' or id = 'rule_notes_overcharge_later');

-- 2. New seed wording (generated from RULES_SEED and BASE_ACTIONS).
update public.content_items i set data = jsonb_set(i.data, '{text}', to_jsonb(v.t))
from (values
  ('rule_turn_steps_overcharge', $t$Use {action:act_overcharge} for 1 extra quick action. It costs Heat, up to {overcharge_heat} a use.$t$),
  ('rule_turn_steps_reaction', $t$Declare 1 reaction at the end of your turn. You commit to it in advance instead of interrupting another post. See {action:act_brace_reaction} and {action:act_overwatch_reaction}.$t$),
  ('rule_notes_tech', $t$Quick Tech actions are {action:act_invade}, {action:act_scan_quick_tech}, {action:act_lock_on_quick_tech}, {action:act_bolster_quick_tech}, or a system's own Quick Tech option. A Full Tech action is two Quick Tech actions (both may be {action:act_invade}, at the same or different targets) or a system's own Full Tech option.$t$),
  ('rule_structure_rest', $t$A short break between scenes. Clear all Heat and statuses. Spend Repairs: 1 restores all HP, 1 fixes one destroyed weapon or system, and {repair_cost} restore 1 Structure or 1 Stress. Some frames cost less, as shown on your mech page.$t$),
  ('rule_foot_pilot_gear', $t$Up to {loadout_weapons} pilot weapons, {loadout_armour} armour and {loadout_gear} gear.$t$),
  ('rule_statuses_engaged', $t$You're Engaged with anyone at Range 1. It ends when either of you moves away, is knocked back or Disengages. You can be Engaged with several enemies at once. While Engaged, Range 6+ attacks get −2 (1 Difficulty).$t$),
  ('rule_range_engaged_melee', $t$You're Engaged with anyone at Range 1. It ends when either of you moves away, is knocked back or Disengages. You can be Engaged with several enemies at once. While Engaged, Range 6+ attacks get −2 (1 Difficulty).$t$)
) as v(id, t)
where i.id = v.id and i.kind = 'rules';

update public.content_items i set data = jsonb_set(i.data, '{detail}', to_jsonb(v.t))
from (values
  ('act_overcharge', $t$Gain 1 extra quick action straight away. Each use costs more Heat, until your next Full Repair. After the last step, the cost stays at {overcharge_heat} Heat.$t$),
  ('act_full_tech', $t$Two Quick Tech actions, which may both be {action:act_invade} at the same or different targets, or a system's own Full Tech option.$t$)
) as v(id, t)
where i.id = v.id and i.kind = 'actions';

-- 3. Number groups (ids stay: rule_number() reads 'rule_num_' || key). The group is structure, so the owner's copy gets it too.
update public.content_items i
set data = jsonb_set(i.data, '{group}', to_jsonb(g)),
    edited = case when i.edited is null then null else jsonb_set(i.edited, '{group}', to_jsonb(g)) end
from (select id, case when id like 'rule\_num\_%' then 'economy' else 'combat' end as g
      from public.content_items
      where kind = 'rules' and (id like 'rule\_num\_%' or id in ('rule_numbers_overcharge_heat', 'rule_numbers_repair_cost'))) x
where i.id = x.id;
