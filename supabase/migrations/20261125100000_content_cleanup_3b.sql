-- Content editor cleanup step 3b.
-- A. The step 3a wording reaches the stored rows, only where a row still holds the old seed text. A row the owner has
--    edited keeps its edit (the seed text under it is updated and a NOTICE names the row for review). A row whose text
--    isn't the old seed text is skipped with a NOTICE. The three rows no longer in the seed go only if untouched.
-- B. The pilot loadout (was 1 Armor, 2 Weapon, 3 Gear) becomes three editable numbers like the prices, read by
--    settle_pilot_gear (free items and the trimmed equipped list, so the submit check too) and equip_pilot_gear.

do $do$
declare
  r record;
  row_ public.content_items;
begin
  for r in select * from (values
  ('tg_reliable', 'tags', 'description', $t$This weapon has some degree of self-correction or is simply powerful enough to cause damage even with a glancing blow. It always does {VAL} damage, even if it misses its target or rolls less damage. Reliable damage inherits other tags (such as AP) and base damage type but not tags that require a hit, such as Knockback.$t$, $t$Always deals at least {VAL} damage, even on a miss.$t$),
  ('act_shut_down_quick', 'actions', 'detail', $t$Clear all Heat and Exposed, and end any condition a tech attack caused. You gain Shutdown until you Boot up.$t$, $t$Clear all Heat and Exposed, and end any condition a tech attack caused. You gain Shutdown until you {action:act_boot_up_full}.$t$),
  ('act_stabilize_full', 'actions', 'detail', $t$Cool down, reload and patch up. Choose one from each line:<ol><li>Clear all Heat to 0, or spend 1 Repair to heal to full HP.</li><li>Reload all Loading weapons, clear all Burn, or clear one condition (such as Impaired or Jammed) on yourself or an Engaged ally.</li></ol>$t$, $t$Cool down, reload and patch up. Choose one from each line:<ol><li>Clear all Heat to 0, or spend 1 Repair (see Rest).</li><li>Reload all Loading weapons, clear all Burn, or clear one condition (such as Impaired or Jammed) on yourself or an Engaged ally.</li></ol>$t$),
  ('rule_notes_reactions', 'rules', 'text', $t$Declare 1 reaction at the end of your turn. You commit to it in advance instead of interrupting another post. Reactions you declare expire at the start of your next turn.$t$, $t$Reactions you declare expire at the start of your next turn.$t$),
  ('rule_notes_pushing', 'rules', 'text', $t$Spend Lancer's Edge (+2) or take 1 narrative stress to close a gap of 1 or 2.$t$, $t$Spend {action:act_lancer_s_edge} or take 1 narrative stress to close a gap of 1 or 2.$t$),
  ('rule_notes_sensors', 'rules', 'text', $t$Sensors set the reach of tech attacks, Lock on and Bolster.$t$, $t$Sensors set the reach of tech attacks, {action:act_lock_on_quick_tech} and {action:act_bolster_quick_tech}.$t$),
  ('rule_notes_tech', 'rules', 'text', $t$Quick Tech actions are {action:act_invade}, {action:act_scan_quick_tech}, {action:act_lock_on_quick_tech}, {action:act_bolster_quick_tech}, or a system's own Quick Tech option. A Full Tech action is two Quick Tech actions (both may be {action:act_invade}, at the same or different targets) or a system's own Full Tech option.$t$, $t$Quick Tech actions are {action:act_invade}, {action:act_scan_quick_tech}, {action:act_lock_on_quick_tech}, {action:act_bolster_quick_tech}, or a system's own Quick Tech option.$t$),
  ('rule_notes_dice', 'rules', 'text', $t$Damage dice become flat damage, rounded up.$t$, $t$Always rounded up.$t$),
  ('rule_turn_steps_movement', 'rules', 'gist', $t$Move using your mech's Speed.$t$, $t$Move using your Speed.$t$),
  ('rule_turn_steps_movement', 'rules', 'text', $t$Move using your mech's Speed.$t$, $t$Move using your Speed.$t$),
  ('rule_turn_steps_1_full', 'rules', 'text', $t$Take 1 full action instead of 2 quick actions. You can't take the same action twice in a turn, unless an ability or Overcharge lets you.$t$, $t$Take 1 full action instead of 2 quick actions. You can't take the same action twice in a turn, unless an ability or {action:act_overcharge} lets you.$t$),
  ('rule_turn_steps_2_quick', 'rules', 'text', $t$Take 2 quick actions instead of 1 full action. You can't take the same action twice in a turn, unless an ability or Overcharge lets you.$t$, $t$Take 2 quick actions instead of 1 full action.$t$),
  ('rule_turn_steps_overcharge', 'rules', 'value', $t$Optional, once a turn$t$, $t$Once a turn$t$),
  ('rule_turn_steps_overcharge', 'rules', 'text', $t$Use {action:act_overcharge} for 1 extra quick action. It costs Heat, up to {overcharge_heat} a use.$t$, $t$Use {action:act_overcharge}.$t$),
  ('rule_turn_steps_free', 'rules', 'text', $t$Free actions cost no action. Core powers and some systems use them.$t$, $t$Free actions cost no action. Core powers, systems and some gear use them.$t$),
  ('rule_statuses_obscured', 'rules', 'text', $t$From smoke, darkness or a system's cloud. Attacks against you from beyond Close get −2 (1 Difficulty), and you can Hide. Seeking weapons can't hit you. Smart weapons ignore it.$t$, $t$From smoke, darkness or a system's cloud. Attacks against you from beyond Close get −2 (1 Difficulty), and you can {action:act_hide_quick}. Seeking weapons can't hit you. Smart weapons ignore it.$t$),
  ('rule_statuses_hidden', 'rules', 'text', $t$Enemies know your rough area, but can't target you with attacks. It ends when you attack, lose your cover or obscurement, or someone finds you with Search.$t$, $t$Enemies know your rough area, but can't target you with attacks. It ends when you attack, lose your cover or obscurement, or someone finds you with {action:act_search_quick}.$t$),
  ('rule_statuses_invisible', 'rules', 'text', $t$Attacks against you get −2 (1 Difficulty). You can Hide in the open without cover or Obscured terrain (unless Engaged). Your movement doesn't trigger Overwatch. You get +1 Speed toward Speed gateways.$t$, $t$Attacks against you get −2 (1 Difficulty). You can {action:act_hide_quick} in the open without cover or Obscured terrain (unless Engaged). Your movement doesn't trigger {action:act_overwatch_reaction}. You get +1 Speed toward Speed gateways.$t$),
  ('rule_statuses_immobilized', 'rules', 'text', $t$You can't move or Boost by choice, and you fail Agility checks and saves. Knockback can still move you.$t$, $t$You can't move or {action:act_boost_quick} by choice, and you fail Agility checks and saves. Knockback can still move you.$t$),
  ('rule_statuses_jammed', 'rules', 'text', $t$You can't make normal ranged or tech attacks, use systems, take reactions or talk over comms. You can only Move, Boost, Improvised attack, Grapple or Ram.$t$, $t$You can't make normal ranged or tech attacks, use systems, take reactions or talk over comms. You can only Move, {action:act_boost_quick}, {action:act_improvised_attack_full}, {action:act_grapple_quick} or {action:act_ram_quick}.$t$),
  ('rule_statuses_slowed', 'rules', 'text', $t$You can't use Speed gateways (only Standard repositioning) and can't Boost.$t$, $t$You can't use Speed gateways (only Standard repositioning) and can't {action:act_boost_quick}.$t$),
  ('rule_statuses_stunned', 'rules', 'text', $t$Until the end of your next turn you can take only 1 quick action (no full actions, Movement, Overcharge or reactions). Attacks against you get +2 (1 Accuracy).$t$, $t$Until the end of your next turn you can take only 1 quick action (no full actions, Movement, {action:act_overcharge} or reactions). Attacks against you get +2 (1 Accuracy).$t$),
  ('rule_statuses_burn_x', 'rules', 'text', $t$Take X burn damage at the end of your turn, ignoring armour. Then Burn goes down by 1 + half your Engineering (rounded down) until it reaches 0. Stabilize clears it at once.$t$, $t$Take X burn damage at the end of your turn, ignoring armour. Then Burn goes down by 1 + half your Engineering (rounded down) until it reaches 0. {action:act_stabilize_full} clears it at once.$t$),
  ('rule_statuses_down_and_out_pilot_status', 'rules', 'text', $t$A pilot at 0 HP. You're Stunned and die if you take any more damage. An ally Engaged with you can use the second choice of Stabilize to bring you back to 1 HP.$t$, $t$A pilot at 0 HP. You're Stunned and die if you take any more damage. An ally Engaged with you can use the second choice of {action:act_stabilize_full} to bring you back to 1 HP.$t$),
  ('rule_statuses_exposed', 'rules', 'text', $t$Kinetic, explosive and energy damage you take is doubled, until you clear it with Stabilize.$t$, $t$Kinetic, explosive and energy damage you take is doubled, until you clear it with {action:act_stabilize_full}.$t$),
  ('rule_statuses_shutdown', 'rules', 'text', $t$You're Stunned, lose all active system effects, and are immune to tech attacks, until you spend a full action to Boot up.$t$, $t$You're Stunned, lose all active system effects, and are immune to tech attacks, until you spend a full action to {action:act_boot_up_full}.$t$),
  ('rule_attacks_3_or_more_over', 'rules', 'text', $t$Or Lancer's Precision on a full hit or grazing hit.<br><b>Critical hit:</b> Damage × 1.25, rounded up, plus on-hit and crit effects.<br><b>Critical hack:</b> Full Heat, full effects and crit effects.$t$, $t$Or {action:act_lancer_s_precision} on a full hit or grazing hit.<br><b>Critical hit:</b> Damage × 1.25, rounded up, plus on-hit and crit effects.<br><b>Critical hack:</b> Full Heat, full effects and crit effects.$t$),
  ('rule_range_1_to_2_threat', 'rules', 'text', $t$Melee only. Make melee attacks and declare Overwatch against targets at Close range (2+) without entering Engagement.$t$, $t$Melee only. Make melee attacks and declare {action:act_overwatch_reaction} against targets at Close range (2+) without entering Engagement.$t$),
  ('rule_range_battlefield_wide', 'rules', 'text', $t$Anywhere in the scene. Ignores Obscured for Lock on and Search.$t$, $t$Anywhere in the scene. Ignores Obscured for {action:act_lock_on_quick_tech} and {action:act_search_quick}.$t$),
  ('rule_structure_full_repair', 'rules', 'text', $t$Downtime between missions, when the GM calls it. Everything returns: HP, Structure, Stress, Repairs, Limited uses, destroyed parts and your Core Power. Overcharge goes back to 1 Heat.$t$, $t$Downtime between missions, when the GM calls it. Everything returns: HP, Structure, Stress, Repairs, Limited uses, destroyed parts and your Core Power. Overcharge goes back to {overcharge_first} Heat.$t$),
  ('rule_foot_pilot_stats', 'rules', 'text', $t$HP 6, E-defence 10, armour 0 and Speed 4, plus gear and talents as on the pilot sheet. Pilots have no Evasion.$t$, $t$HP, E-defence, armour and Speed are on your pilot sheet. Pilots have no Evasion.$t$),
  ('rule_foot_melt_down', 'rules', 'text', $t$The reactor explodes at the end of your next turn, like Self-destruct. The pilot must Eject before then or dies.$t$, $t$The reactor explodes at the end of your next turn, like {action:act_self_destruct_quick}. The pilot must {action:act_eject_quick} before then or dies.$t$),
  ('rule_sizes_auxiliary', 'rules', 'text', $t$Light weapons. A mount holding two Auxiliary weapons (Flex or Aux/Aux) fires both with one Skirmish or Barrage. The second one deals its base damage only, without bonus damage.$t$, $t$Light weapons. A mount holding two Auxiliary weapons (Flex or Aux/Aux) fires both with one {action:act_skirmish_quick} or {action:act_barrage_full}. The second one deals its base damage only, without bonus damage.$t$),
  ('rule_sizes_heavy', 'rules', 'text', $t$High-impact weapons. They can't be fired with Overwatch unless a talent says so.$t$, $t$High-impact weapons. They can't be fired with {action:act_overwatch_reaction} unless a talent says so.$t$),
  ('rule_sizes_superheavy', 'rules', 'text', $t$Takes up two mounts and needs a full action (Barrage) to fire. It can't be used with Skirmish or Overwatch.$t$, $t$Takes up two mounts and needs a full action ({action:act_barrage_full}) to fire. It can't be used with {action:act_skirmish_quick} or {action:act_overwatch_reaction}.$t$),
  ('rule_numbers_repair_cost', 'rules', 'text', $t$Repairs to restore 1 Structure or 1 Stress at a Rest.$t$, $t$Repairs per Structure or Stress.$t$)
  ) as v(id, kind, col, old_text, new_text) loop
    select * into row_ from public.content_items where id = r.id and kind = r.kind;
    if not found then
      raise notice 'Skipped %: no such row.', r.id;
    elsif row_.data -> r.col = to_jsonb(r.new_text) then
      null; -- already done
    elsif row_.data -> r.col is distinct from to_jsonb(r.old_text) then
      raise notice 'Skipped % (%): the stored text is not the old seed text.', r.id, r.col;
    else
      update public.content_items set data = jsonb_set(data, array[r.col], to_jsonb(r.new_text)) where id = r.id and kind = r.kind;
      if row_.edited is not null then
        raise notice 'Updated the seed text of % (%), but the owner has edited it: review the edit.', r.id, r.col;
      end if;
    end if;
  end loop;

  for r in select * from (values
  ('rule_notes_movement_how', $t$Move up to your Speed.$t$),
  ('rule_notes_movement_pilot', $t$Move using your Speed.$t$),
  ('rule_notes_free_pilot', $t$Free actions cost no action. Some gear uses them.$t$)
  ) as v(id, old_text) loop
    select * into row_ from public.content_items where id = r.id and kind = 'rules';
    if not found then
      null; -- already gone
    elsif row_.edited is not null or row_.data ->> 'text' is distinct from r.old_text then
      raise notice 'Kept %: it was edited or changed. Delete it by hand if it is not needed.', r.id;
    else
      delete from public.content_items where id = r.id and kind = 'rules';
    end if;
  end loop;
end;
$do$;

-- B. Loadout numbers. Keep in step with NUMBER_KEYS in src/rulesData.ts (rules.test.ts reads these values).
insert into public.rule_number_limits (key, def, lo, hi) values
  ('loadout_armour', 1, 0, 6),
  ('loadout_weapons', 2, 0, 6),
  ('loadout_gear', 3, 0, 6);

-- Copied from 20261121110000_pilot_inventory.sql; only the slot numbers (were 1 Armor, 2 Weapon, 3 Gear) come from rule_number.
create or replace function public.settle_pilot_gear(proposed jsonb, live jsonb, first_approval boolean) returns jsonb
language sql stable set search_path = ''
as $$
  with owned as (
    select e.value as entry, e.ordinality as n, e.value ->> 'key' as key, e.value ->> 'id' as id,
      coalesce(i.edited, i.data) ->> 'type' as type
    from jsonb_array_elements(case when jsonb_typeof(proposed -> 'owned_gear') = 'array' then proposed -> 'owned_gear' else '[]' end)
      with ordinality e
    left join public.content_items i on i.kind = 'pilot_gear' and i.id = e.value ->> 'id'
  ), live_owned as (
    select e ->> 'key' as key, e ->> 'id' as id, e -> 'free' = 'true'::jsonb as free
    from jsonb_array_elements(case when jsonb_typeof(live -> 'owned_gear') = 'array' then live -> 'owned_gear' else '[]' end) e
  ), candidates as (
    -- On first approval with no live sheet everything can be free; otherwise only what the live sheet had free.
    select o.*, (first_approval and live is null)
      or exists (select 1 from live_owned l where l.key = o.key and l.id = o.id and l.free) as may_be_free
    from owned o
  ), settled as (
    select c.n, case when jsonb_typeof(c.entry) <> 'object' then c.entry else c.entry || jsonb_build_object('free',
      case when first_approval
        then c.may_be_free and coalesce(row_number() over (partition by c.type, c.may_be_free order by c.n)
                      <= case c.type when 'Armor' then public.rule_number('loadout_armour') when 'Weapon' then public.rule_number('loadout_weapons') when 'Gear' then public.rule_number('loadout_gear') end, false)
        else row_number() over (partition by c.key order by c.n) = 1 and c.may_be_free
      end) end as entry
    from candidates c
  ), equipped as (
    select q.k, min(q.n) as n,
      (select o.type from owned o where o.key = q.k order by o.n limit 1) as type
    from jsonb_array_elements_text(case
        when jsonb_typeof(case when first_approval then proposed else live end -> 'equipped_gear') = 'array'
        then (case when first_approval then proposed else live end) -> 'equipped_gear' else '[]' end
      ) with ordinality q(k, n)
    where exists (select 1 from owned o where o.key = q.k)
    group by q.k
  ), kept as (
    -- First approval also trims the player's list to 1 Armor, 2 Weapon and 3 Gear, in list order.
    select e.k, e.n from (select e.*, row_number() over (partition by e.type order by e.n) as r from equipped e) e
    where not first_approval or e.r <= case e.type when 'Armor' then public.rule_number('loadout_armour') when 'Weapon' then public.rule_number('loadout_weapons') when 'Gear' then public.rule_number('loadout_gear') end
  )
  select coalesce(proposed, '{}') || jsonb_build_object(
    'owned_gear', coalesce((select jsonb_agg(s.entry order by s.n) from settled s), '[]'),
    'equipped_gear', coalesce((select jsonb_agg(k.k order by k.n) from kept k), '[]'));
$$;

-- Copied from 20261121110000_pilot_inventory.sql; only the slot numbers and the error text come from rule_number.
create or replace function public.equip_pilot_gear(target_character_id bigint, keys text[]) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  pilot public.characters;
  owned jsonb;
  full_type text;
  stamp timestamptz;
  room numeric;
begin
  select * into pilot from public.characters where id = target_character_id for update;
  if not found or not (public.is_gm() or pilot.player_id = (select auth.uid())) then
    raise exception 'Not your pilot.';
  end if;
  if pilot.status <> 'approved' then
    raise exception 'Only an approved pilot can change equipped gear.';
  end if;
  keys := coalesce(keys, '{}');

  select s.sheet -> 'owned_gear' into owned from public.character_sheets s where s.character_id = target_character_id for update;
  owned := case when jsonb_typeof(owned) = 'array' then owned else '[]' end;

  if exists (
    select 1 from unnest(keys) k
    where k is null or not exists (select 1 from jsonb_array_elements(owned) e where e ->> 'key' = k)
  ) then
    raise exception 'Not owned.';
  end if;
  if cardinality(keys) <> (select count(distinct k) from unnest(keys) k) then
    raise exception 'Equipped twice.';
  end if;
  if exists (
    select 1 from unnest(keys) k
    cross join lateral (select e ->> 'id' as id from jsonb_array_elements(owned) e where e ->> 'key' = k limit 1) o
    left join public.content_items i on i.kind = 'pilot_gear' and i.id = o.id
    where coalesce(coalesce(i.edited, i.data) ->> 'type', '') not in ('Armor', 'Weapon', 'Gear')
  ) then
    raise exception 'Not pilot gear.';
  end if;

  select c.type into full_type
  from (
    select coalesce(i.edited, i.data) ->> 'type' as type, count(*) as n
    from unnest(keys) k
    cross join lateral (select e ->> 'id' as id from jsonb_array_elements(owned) e where e ->> 'key' = k limit 1) o
    join public.content_items i on i.kind = 'pilot_gear' and i.id = o.id
    group by 1
  ) c
  where c.n > case c.type when 'Armor' then public.rule_number('loadout_armour') when 'Weapon' then public.rule_number('loadout_weapons') when 'Gear' then public.rule_number('loadout_gear') end
  order by c.type
  limit 1;
  if full_type is not null then
    room := case full_type when 'Armor' then public.rule_number('loadout_armour')
      when 'Weapon' then public.rule_number('loadout_weapons') else public.rule_number('loadout_gear') end;
    raise exception '%', case full_type
      when 'Armor' then case room when 0 then 'No pilot armour fits.' when 1 then 'Only 1 pilot armour fits.' else format('Only %s pilot armour fit.', room) end
      when 'Weapon' then case room when 0 then 'No pilot weapons fit.' when 1 then 'Only 1 pilot weapon fits.' else format('Only %s pilot weapons fit.', room) end
      else case room when 0 then 'No pilot gear fits.' when 1 then 'Only 1 pilot gear fits.' else format('Only %s pilot gear fit.', room) end end;
  end if;

  update public.character_sheets
  set sheet = jsonb_set(sheet, '{equipped_gear}', to_jsonb(keys))
  where character_id = target_character_id
  returning updated_at into stamp;
  return stamp;
end;
$$;
