import { shallowRef } from 'vue'
import { FIGHT, FULL_ACTIONS, IMPROVISED, JOCKEY, OVERCHARGE, PILOT_ACTIONS, PILOT_OVERWATCH, QUICK_ACTIONS, REACTIONS, SCENE_RESOURCES, type CombatAction } from './combatRules'

// The base actions as editable content (content_items kind 'actions'). The combatRules.ts lists are their seed only. "mech" and "pilot" say which Combat page modes list them.
export type BaseAction = CombatAction & { id: string; mech: boolean; pilot: boolean }

// Every id is written out, in BASE_ACTIONS order, so renaming an action never orphans its database row (baseActions.test.ts pins them).
const ACTION_IDS = [
  'act_lancer_s_edge', 'act_lancer_s_precision', 'act_skirmish_quick', 'act_boost_quick', 'act_reload_quick', 'act_invade', 'act_lock_on_quick_tech',
  'act_bolster_quick_tech', 'act_hide_quick', 'act_search_quick', 'act_prepare_quick', 'act_ram_quick', 'act_grapple_quick', 'act_scan_quick_tech',
  'act_activate_quick', 'act_skill_check_quick', 'act_shut_down_quick', 'act_eject_quick', 'act_self_destruct_quick', 'act_barrage_full',
  'act_disengage_full', 'act_stabilize_full', 'act_boot_up_full', 'act_full_tech', 'act_activate_full', 'act_mount_or_dismount_full',
  'act_core_power_rules', 'act_brace_reaction', 'act_overwatch_reaction', 'act_reaction_systems_reaction', 'act_overcharge',
  'act_improvised_attack_full', 'act_fight_full', 'act_jockey_full', 'act_overwatch_pilot',
]

export const SCENE_RESOURCE_IDS = ACTION_IDS.slice(0, SCENE_RESOURCES.length)

export const BASE_ACTIONS: BaseAction[] = [
  ...SCENE_RESOURCES.map((a) => ({ a, mech: false })), // read by the turn card, not the action lists
  ...[...QUICK_ACTIONS, ...FULL_ACTIONS, ...REACTIONS, OVERCHARGE, IMPROVISED].map((a) => ({ a, mech: true })),
  ...[FIGHT, JOCKEY, PILOT_OVERWATCH].map((a) => ({ a, mech: false })), // pilot only
].map(({ a, mech }, i) => ({ ...a, id: ACTION_IDS[i], mech, pilot: PILOT_ACTIONS.includes(a) }))

// The base actions the Combat page lists (hidden ones left out). Empty until gameData.ts loadBaseActions() fills it. Here, not in
// gameData.ts, so rulesData.ts can read action names for "{action:id}" without a cycle.
export const baseActions = shallowRef<BaseAction[]>([])

// The item data stored for a seed action. Empty fields are left out.
export const actionData = ({ id, name, activation, frequency, gist, group, text, mech, pilot }: BaseAction) => ({
  id, name, ...(activation && { activation }), ...(frequency && { frequency }), ...(gist && { terse: gist }), ...(group && { group }), detail: text, mech, pilot,
})

const GROUPS = ['attack', 'tech', 'other', 'move']
// Stored data to an action. Unreadable rows are dropped, hidden ones too.
export function toBaseAction(id: string, data: unknown): BaseAction | null {
  const d = (data ?? {}) as Record<string, unknown>
  const text = (key: string) => (typeof d[key] === 'string' && d[key].trim() ? (d[key] as string) : undefined)
  const name = text('name')
  if (!name || d.hidden === true) return null
  return { id, name, activation: text('activation'), frequency: text('frequency'), gist: text('terse'), group: GROUPS.includes(String(d.group)) ? (d.group as BaseAction['group']) : undefined, text: text('detail') ?? '', mech: d.mech === true, pilot: d.pilot === true }
}
