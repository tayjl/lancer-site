import { shallowRef } from 'vue'
import { baseActions } from './baseActions'
import * as C from './combatRules'
import type { CombatRow } from './combatRules'

// The combat guide's rules as editable content (content_items kind 'rules'). The combatRules.ts constants are the seed only, the
// database is the live copy. One item is one entry. Fields by section shape:
//   note: name, text. steps: name, value (the frequency), gist, text. table: name, value (the short value column, when the
//   row has both), short, gist, text, icon, group. numbers: name, group (combat or economy), numbers.
// Placeholders in text (see fill): a number key like "{loadout_gear}" or "{overcharge_heat}", and "{action:<id>}" for an action's name.
export type RuleItem = {
  id: string; name: string; section: string; group?: string; value?: string; short?: string; gist?: string
  text: string; icon?: string; order: number; numbers?: number[]; hidden?: boolean
}
export type RuleShape = 'note' | 'steps' | 'table' | 'numbers'
export type RuleSection = { id: string; label: string; shape: RuleShape; groups?: { id: string; label: string }[] }

const groups = (...pairs: [string, string][]) => pairs.map(([id, label]) => ({ id, label }))
// The cards of the Statuses tab. "pilot" rows sit in Other, and in the On foot card in Pilot mode.
const STATUS_CARDS = [{ id: 'cover', title: 'Cover and stealth', icon: 'shield' }, { id: 'conditions', title: 'Conditions', icon: 'warning' }, { id: 'other', title: 'Other statuses', icon: 'info' }]

export const SECTIONS: RuleSection[] = [
  { id: 'notes', label: 'Notes', shape: 'note' },
  { id: 'turn_steps', label: 'Turn steps', shape: 'steps' },
  { id: 'statuses', label: 'Statuses', shape: 'table', groups: groups(...STATUS_CARDS.map((g): [string, string] => [g.id, g.title]), ['pilot', 'Pilot statuses']) },
  { id: 'checks', label: 'Checks', shape: 'table', groups: groups(['formula', 'Formulas'], ['result', 'Results'], ['dc', 'Pilot DCs']) },
  { id: 'attacks', label: 'Attacks and damage', shape: 'table', groups: groups(['formula', 'Attack formulas'], ['result', 'Attack results'], ['damage_formula', 'Damage formulas'], ['extra', 'Extra rules'], ['damage_type', 'Damage types'], ['defence', 'Defence baselines']) },
  { id: 'movement', label: 'Movement', shape: 'table', groups: groups(['gateway', 'Speed gateways'], ['terrain', 'Terrain'], ['knockback', 'Knockback']) },
  { id: 'range', label: 'Range', shape: 'table', groups: groups(['tier', 'Range tiers'], ['area', 'Areas'], ['bonus', 'Range and Threat bonuses'], ['sensor', 'Sensors'], ['aura', 'Auras'], ['talent', 'Range in talents']) },
  { id: 'structure', label: 'Structure and repairs', shape: 'table', groups: groups(['trigger', 'Triggers'], ['step', 'Structure and stress steps'], ['repair', 'Repairs']) },
  { id: 'foot', label: 'Pilots on foot', shape: 'table', groups: groups(['stats', 'Pilot stats and gear'], ['attacks', 'Pilot attacks'], ['on_foot', 'On foot']) },
  { id: 'sizes', label: 'Weapon sizes', shape: 'table' },
  { id: 'dice', label: 'Dice conversions', shape: 'table', groups: groups(['dice', 'Dice'], ['recharge', 'Recharge']) },
  { id: 'numbers', label: 'Numbers', shape: 'numbers', groups: groups(['combat', 'Combat numbers'], ['economy', 'Economy and levelling']) },
]

// ---- the seed ----
// Every seed id is written out, in the order add() is called below, so renaming a seed entry never orphans its database row.
// rules.test.ts pins the list: a new entry takes a new id, placed where its add() call reaches it.
const SEED_IDS = [
  'rule_turn_steps_protocol', 'rule_turn_steps_movement', 'rule_turn_steps_1_full', 'rule_turn_steps_2_quick', 'rule_turn_steps_overcharge',
  'rule_turn_steps_free', 'rule_turn_steps_reaction', 'rule_statuses_barrier_protected', 'rule_statuses_screened', 'rule_statuses_obscured',
  'rule_statuses_hidden', 'rule_statuses_invisible', 'rule_statuses_intangible', 'rule_statuses_immobilized', 'rule_statuses_impaired',
  'rule_statuses_jammed', 'rule_statuses_lock_on', 'rule_statuses_shredded', 'rule_statuses_slowed', 'rule_statuses_stunned', 'rule_statuses_burn_x',
  'rule_statuses_danger_zone', 'rule_statuses_down_and_out_pilot_status', 'rule_statuses_engaged', 'rule_statuses_exposed', 'rule_statuses_prone',
  'rule_statuses_shutdown', 'rule_checks_check_or_save_10_hull_agility_systems_or_engineering', 'rule_checks_over_the_dc',
  'rule_checks_under_the_dc', 'rule_checks_equal_to_the_dc', 'rule_checks_dc_12', 'rule_checks_dc_14', 'rule_checks_dc_16',
  'rule_attacks_attack_10_grit_or_npc_bonus_accuracy_difficulty', 'rule_attacks_tech_attack_10_tech_attack_accuracy_difficulty',
  'rule_attacks_1_accuracy_2_1_difficulty_2', 'rule_attacks_3_or_more_over', 'rule_attacks_equal_up_to_2_over', 'rule_attacks_1_to_3_under',
  'rule_attacks_4_or_more_under', 'rule_attacks_critical_hit_weapon_damage_flat_bonuses_1_25_rounded_up',
  'rule_attacks_grazing_hit_damage_2_rounded_up', 'rule_attacks_damage_taken_damage_armour', 'rule_attacks_grit', 'rule_attacks_bonus_damage',
  'rule_attacks_damage_resistance', 'rule_attacks_heat_as_damage', 'rule_attacks_kinetic', 'rule_attacks_explosive', 'rule_attacks_energy',
  'rule_attacks_burn', 'rule_attacks_light_or_nimble', 'rule_attacks_medium_or_standard', 'rule_attacks_heavy_or_superheavy',
  'rule_movement_standard_repositioning', 'rule_movement_cross_field_maneuver', 'rule_movement_extreme_dash', 'rule_movement_difficult_terrain',
  'rule_movement_dangerous_terrain', 'rule_movement_knockback_1', 'rule_movement_knockback_2', 'rule_movement_knockback_3',
  'rule_range_engaged_melee', 'rule_range_close', 'rule_range_medium', 'rule_range_far', 'rule_range_extreme', 'rule_range_burst',
  'rule_range_blast', 'rule_range_cone', 'rule_range_line', 'rule_range_1_to_4_range', 'rule_range_5_range_or_more', 'rule_range_1_to_2_threat',
  'rule_range_short_range', 'rule_range_tactical', 'rule_range_battlefield_wide', 'rule_range_aura_1_2', 'rule_range_aura_3_7', 'rule_range_aura_8',
  'rule_range_within_range_3', 'rule_range_beyond_range_5_or_8', 'rule_structure_structure', 'rule_structure_stress', 'rule_structure_step_1',
  'rule_structure_step_2', 'rule_structure_step_3', 'rule_structure_step_4', 'rule_structure_rest', 'rule_structure_full_repair',
  'rule_foot_pilot_stats', 'rule_foot_pilot_attacks', 'rule_foot_attacks_on_a_pilot', 'rule_foot_mech_destroyed', 'rule_foot_melt_down',
  'rule_foot_pilot_gear', 'rule_sizes_auxiliary', 'rule_sizes_main', 'rule_sizes_heavy', 'rule_sizes_superheavy', 'rule_dice_1d3', 'rule_dice_1d6',
  'rule_dice_2d6', 'rule_dice_3d6', 'rule_dice_recharge_4_or_50', 'rule_dice_recharge_5', 'rule_dice_recharge_6',
  'rule_numbers_overcharge_heat', 'rule_numbers_repair_cost',
]
let seeded = 0
const count: Record<string, number> = {}
const seed: RuleItem[] = []
const add = (section: string, group: string | undefined, rows: Omit<RuleItem, 'id' | 'section' | 'group' | 'order'>[]) => {
  for (const row of rows) {
    const item = { id: SEED_IDS[seeded++], section, group, ...row, order: (count[section] = (count[section] ?? 0) + 10) }
    seed.push(Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined)) as RuleItem)
  }
}
// A table row. A row with a name keeps its value column (value); "prefix" turns a bare value into a name ("Knockback 1").
const row = (r: CombatRow, prefix = '') => ({ name: r.name ?? `${prefix}${r.value}`, value: r.name || prefix ? r.value : undefined, short: r.short, gist: r.gist, text: r.text, icon: r.icon })
const rows = (list: CombatRow[], prefix = '') => list.map((r) => row(r, prefix))
const formulas = (list: C.CombatFormula[]) => list.map((f) => ({ name: f.formula, text: [f.note, `Example: ${f.example}`].filter(Boolean).join('<br>') }))

const NOTES: [string, string, string][] = [
  ['resources', 'Scene resources', C.RESOURCES_NOTE], ['reactions', 'Reactions', C.REACTIONS_NOTE], ['results', 'Results', C.RESULTS_NOTE],
  ['pilot_checks', 'Pilot checks', C.PILOT_CHECKS_NOTE], ['pushing', 'Pushing through', C.PUSHING_THROUGH], ['movement', 'Movement', C.MOVEMENT_NOTE],
  ['knockback', 'Knockback', C.KNOCKBACK_NOTE], ['sensors', 'Sensors', C.SENSORS_NOTE], ['auras', 'Auras', C.AURAS_NOTE], ['cover', 'Cover', C.COVER_NOTE],
  ['conversions', 'Dice conversions', C.CONVERSIONS_NOTE], ['tech', 'Tech actions', C.TECH_NOTE], ['dice', 'Dice', C.DICE_NOTE], ['structure', 'Structure', C.STRUCTURE_NOTE],
  ['drones', 'Drones', C.DRONES_NOTE], ['size', 'Size', C.SIZE_NOTE],
  ['movement_how', 'Movement step', 'Move up to your Speed.'], ['movement_pilot', 'Movement step on foot', 'Move using your Speed.'],
  ['free_pilot', 'Free actions on foot', 'Free actions cost no action. Some gear uses them.'], ['sidearm_needed', 'Sidearm Fight', 'Needs a Sidearm weapon.'],
]
for (const [key, name, text] of NOTES) seed.push({ id: `rule_notes_${key}`, name, section: 'notes', text, order: (count.notes = (count.notes ?? 0) + 10) })

add('turn_steps', undefined, C.TURN_STEPS.map((s) => ({ name: s.name, value: s.frequency, gist: s.gist, text: s.text })))
// What a turn step lists is fixed in code, by the step's id.
const STEP_FIXED = new Map(seed.filter((r) => r.section === 'turn_steps').map((r, i) => [r.id, { key: C.TURN_STEPS[i].name, activations: C.TURN_STEPS[i].activations }]))

C.STATUS_GROUPS.forEach((g, i) => add('statuses', STATUS_CARDS[i].id, rows(g.rows)))
const downAndOut = seed.find((r) => r.id === 'rule_statuses_down_and_out_pilot_status')!
downAndOut.group = 'pilot'
add('checks', 'formula', formulas(C.CHECK_FORMULAS))
add('checks', 'result', rows(C.CHECK_RESULTS))
add('checks', 'dc', rows(C.PILOT_DCS, 'DC '))
add('attacks', 'formula', formulas(C.ATTACK_FORMULAS))
add('attacks', 'result', C.ATTACK_RESULTS.map((r) => ({ name: r.margin, text: [r.note ? `${r.note}.` : '', `<b>${r.physical[0]}:</b> ${r.physical[1]}`, `<b>${r.tech[0]}:</b> ${r.tech[1]}`].filter(Boolean).join('<br>') })))
add('attacks', 'damage_formula', formulas(C.DAMAGE_FORMULAS))
add('attacks', 'extra', rows(C.ATTACK_EXTRAS))
add('attacks', 'damage_type', C.DAMAGE_TYPES.map((t) => ({ name: t.name, icon: t.icon, text: '' })))
add('attacks', 'defence', C.DEFENCES.map((d) => ({ name: d.mech, text: `Evasion ${d.evasion}<br>E-defence ${d.edef}` })))
add('movement', 'gateway', rows(C.SPEED_GATEWAYS))
add('movement', 'terrain', rows(C.TERRAIN))
add('movement', 'knockback', rows(C.KNOCKBACK, 'Knockback '))
add('range', 'tier', rows(C.RANGE_TIERS))
add('range', 'area', rows(C.AREAS))
add('range', 'bonus', rows(C.RANGE_BONUSES))
add('range', 'sensor', rows(C.SENSORS))
add('range', 'aura', rows(C.AURAS, 'Aura '))
add('range', 'talent', rows(C.RANGE_TALENTS))
add('structure', 'trigger', C.STRUCTURE_TRIGGERS.map((t) => ({ name: t.name, icon: t.icon, text: t.text })))
add('structure', 'step', C.STRUCTURE_STRESS.map((s) => ({ name: `Step ${s.n}`, text: `<b>Structure:</b> ${s.structure}<br><b>Stress:</b> ${s.stress}` })))
add('structure', 'repair', rows(C.REPAIRS))
const FOOT_GROUP: Record<string, string> = { 'Pilot stats': 'stats', 'Pilot gear': 'stats', 'Pilot attacks': 'attacks', 'Attacks on a pilot': 'attacks' }
for (const r of C.FOOT_RULES) add('foot', FOOT_GROUP[r.value] ?? 'on_foot', rows([r]))
add('sizes', undefined, rows(C.WEAPON_SIZES))
add('dice', 'dice', rows(C.DICE))
add('dice', 'recharge', rows(C.RECHARGE))
const SEED_NUMBERS = { overcharge_heat: C.OVERCHARGE_HEAT, repair_cost: [C.REPAIR_COST] }
add('numbers', 'combat', [
  { name: 'Overcharge heat', text: 'Heat for each Overcharge use. The last number repeats.', numbers: SEED_NUMBERS.overcharge_heat },
  { name: 'Repair cost', text: 'Repairs to restore 1 Structure or 1 Stress at a Rest.', numbers: SEED_NUMBERS.repair_cost },
])

// The game-balance numbers owners can edit, one 'rules' row each (id rule_num_<key>, numbers [value]). The database reads the same
// rows with public.rule_number(key), whose def/lo/hi live in the table rule_number_limits (migration 20261124100000), so they must equal its rows
// (rules.test.ts checks). All are whole numbers. "db" is false for the ones only the site uses.
export type NumberKey = (typeof NUMBER_KEYS)[number]['key']
export const NUMBER_KEYS = [
  { key: 'starting_manna', label: 'Starting manna', def: 2000, lo: 0, hi: 100000, db: true, hint: 'Manna a new pilot starts with.' },
  { key: 'licence_rank_price', label: 'Licence rank price', def: 600, lo: 0, hi: 10000, db: true, hint: 'Manna for each licence rank.' },
  { key: 'talent_rank_price', label: 'Talent rank price', def: 300, lo: 0, hi: 10000, db: true, hint: 'Manna for each talent rank.' },
  { key: 'extra_mech_price', label: 'Extra mech price', def: 500, lo: 0, hi: 10000, db: true, hint: 'Manna for each mech after the first.' },
  { key: 'default_gear_price', label: 'Default gear price', def: 100, lo: 0, hi: 10000, db: true, hint: 'Manna for pilot gear with no price of its own.' },
  { key: 'max_licence_rank', label: 'Highest licence rank', def: 3, lo: 1, hi: 6, db: true, hint: 'The most ranks one licence can have.' },
  { key: 'max_talent_rank', label: 'Highest talent rank', def: 3, lo: 1, hi: 6, db: true, hint: 'The most ranks one talent can have.' },
  { key: 'mod_points_base', label: 'Mod points at level 0', def: 6, lo: 0, hi: 50, db: true, hint: 'Each level adds one more.' },
  { key: 'skill_points_base', label: 'HASE points at level 0', def: 2, lo: 0, hi: 20, db: false, hint: 'Each level adds one more.' },
  { key: 'personal_stat_min', label: 'Lowest personal stat', def: 2, lo: 0, hi: 10, db: false, hint: 'Must not be above the highest.' },
  { key: 'personal_stat_max', label: 'Highest personal stat', def: 4, lo: 1, hi: 20, db: false, hint: 'Must not be below the lowest.' },
  { key: 'personal_stat_points', label: 'Personal stat points', def: 4, lo: 0, hi: 50, db: false, hint: 'Points to raise stats above the lowest.' },
  { key: 'loadout_armour', label: 'Armour slots', def: 1, lo: 0, hi: 6, db: false, hint: 'Pilot armour a pilot can equip.' },
  { key: 'loadout_weapons', label: 'Weapon slots', def: 2, lo: 0, hi: 6, db: false, hint: 'Pilot weapons a pilot can equip.' },
  { key: 'loadout_gear', label: 'Gear slots', def: 3, lo: 0, hi: 6, db: false, hint: 'Pilot gear items a pilot can equip.' },
] as const
export const numberKeyOf = (id: string) => NUMBER_KEYS.find((n) => id === `rule_num_${n.key}`)
for (const n of NUMBER_KEYS)
  seed.push({ id: `rule_num_${n.key}`, name: n.label, section: 'numbers', group: 'economy', text: n.hint, numbers: [n.def], order: (count.numbers = (count.numbers ?? 0) + 10) })

export const RULES_SEED: RuleItem[] = seed
// The item data stored for a seed rule.
export const ruleData = (item: RuleItem) => ({ ...item })

// Stored data to a rule. Unreadable rows are dropped. Hidden ones are kept (the getters skip them).
export function toRuleItem(id: string, data: unknown): RuleItem | null {
  const d = (data ?? {}) as Record<string, unknown>
  const text = (key: string) => (typeof d[key] === 'string' && d[key].trim() ? (d[key] as string) : undefined)
  const name = text('name')
  if (!name || !SECTIONS.some((s) => s.id === d.section)) return null
  const numbers = Array.isArray(d.numbers) && d.numbers.every((n) => typeof n === 'number' && Number.isFinite(n)) ? (d.numbers as number[]) : undefined
  return {
    id, name, section: d.section as string, group: text('group'), value: text('value'), short: text('short'), gist: text('gist'), text: typeof d.text === 'string' ? d.text : '', icon: text('icon'),
    order: typeof d.order === 'number' && Number.isFinite(d.order) ? d.order : 1_000_000, numbers, hidden: d.hidden === true,
  }
}

// What the page reads. Empty until gameData.ts loadRules() fills it from the database.
export const ruleItems = shallowRef<RuleItem[]>([])

const live = (section: string, group?: string) =>
  ruleItems.value.filter((i) => !i.hidden && i.section === section && (!group || i.group === group)).sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))

// No number item gives the seed's, so a calculation never loses its number.
export const ruleNumbers = (key: keyof typeof SEED_NUMBERS): number[] => {
  const found = live('numbers').find((i) => i.id === `rule_numbers_${key}`)?.numbers
  return found?.length ? found : SEED_NUMBERS[key]
}
// A balance number, like the database's rule_number: the stored value when it is a whole number inside its range, else the default.
const stored = (n: (typeof NUMBER_KEYS)[number]) => {
  const v = live('numbers').find((i) => i.id === `rule_num_${n.key}`)?.numbers?.[0]
  return typeof v === 'number' && Number.isInteger(v) && v >= n.lo && v <= n.hi ? v : n.def
}
export const rule = (key: NumberKey): number => {
  const n = NUMBER_KEYS.find((k) => k.key === key)!
  // The highest personal stat can't be below the lowest: if it is, both go back to their defaults.
  if (key === 'personal_stat_min' || key === 'personal_stat_max') {
    const [lo, hi] = ['personal_stat_min', 'personal_stat_max'].map((k) => stored(NUMBER_KEYS.find((x) => x.key === k)!))
    return lo > hi ? n.def : stored(n)
  }
  return stored(n)
}
// Fills the placeholders in rule text. A missing or hidden action is left out with its comma. Any other unknown placeholder (a typo, {VAL}) stays as written.
export const fill = (text: string) => text.replace(/(, )?\{action:([\w-]+)\}(, )?/g, (whole, _before, id: string) => (baseActions.value.some((a) => a.id === id) ? whole : '')).replace(/\{(action:[\w-]+|\w+)\}/g, (whole, key: string) => {
  if (key.startsWith('action:')) return baseActions.value.find((a) => a.id === key.slice(7))?.name ?? ''
  if (key === 'overcharge_heat') return String(ruleNumbers('overcharge_heat').at(-1))
  if (key === 'repair_cost') return String(ruleNumbers('repair_cost')[0])
  const n = NUMBER_KEYS.find((k) => k.key === key)
  return n ? String(rule(n.key)) : whole
})
export const ruleNote = (key: string) => fill(live('notes').find((i) => i.id === `rule_notes_${key}`)?.text ?? '')

// A table row in the shape the page uses: a row with only a name has it as its value.
export type RuleRow = CombatRow & { id: string; group?: string }
const asRow = (i: RuleItem): RuleRow => ({ id: i.id, group: i.group, value: i.value ?? i.name, name: i.value ? i.name : undefined, short: i.short, gist: i.gist, text: fill(i.text), icon: i.icon })
export const ruleRows = (section: string, group?: string) => live(section, group).map(asRow)

export type TurnStep = { id: string; key: string; name: string; activations: string[]; frequency?: string; gist?: string; text: string }
export const turnSteps = (): TurnStep[] => live('turn_steps').map((i) => ({ id: i.id, name: i.name, key: STEP_FIXED.get(i.id)?.key ?? i.id, activations: STEP_FIXED.get(i.id)?.activations ?? [], frequency: i.value, gist: i.gist, text: fill(i.text) }))
export const turnStepText = (key: string) => turnSteps().find((s) => s.key === key)?.text ?? ''

export const statusGroups = () => STATUS_CARDS.map((g) => ({ ...g, rows: live('statuses').filter((i) => i.group === g.id || (g.id === 'other' && i.group === 'pilot')).map(asRow) }))
// The Statuses tab's "On foot" card (Pilot mode).
export const onFootRows = (): RuleRow[] => [...ruleRows('statuses', 'pilot'), ...ruleRows('foot', 'on_foot')]
