import { shallowRef } from 'vue'
import * as C from './combatRules'
import type { CombatRow } from './combatRules'

// The combat guide's rules as editable content (content_items kind 'rules'). The combatRules.ts constants are the seed, and
// the fallback when the load fails or no rule rows exist. One item is one entry. Fields by section shape:
//   note: name, text. steps: name, value (the frequency), gist, text. table: name, value (the short value column, when the
//   row has both), short, gist, text, icon, group. tags: name is a tag id. numbers: name, numbers.
// "{HEAT}" and "{REPAIR}" in text are filled from the numbers section.
export type RuleItem = {
  id: string; name: string; section: string; group?: string; value?: string; short?: string; gist?: string
  text: string; icon?: string; order: number; numbers?: number[]; hidden?: boolean
}
export type RuleShape = 'note' | 'steps' | 'table' | 'tags' | 'numbers'
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
  { id: 'tag_list', label: 'Tags card', shape: 'tags' },
  { id: 'numbers', label: 'Numbers', shape: 'numbers' },
]

// ---- the seed ----
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const count: Record<string, number> = {}
const seed: RuleItem[] = []
const add = (section: string, group: string | undefined, rows: Omit<RuleItem, 'id' | 'section' | 'group' | 'order'>[]) => {
  for (const row of rows) {
    const item = { id: `rule_${section}_${slug(row.name)}`, section, group, ...row, order: (count[section] = (count[section] ?? 0) + 10) }
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
  ['drones', 'Drones', C.DRONES_NOTE], ['size', 'Size', C.SIZE_NOTE], ['overcharge_later', 'Overcharge later uses', C.OVERCHARGE_LATER],
  ['movement_how', 'Movement step', 'Move up to your Speed.'], ['movement_pilot', 'Movement step on foot', 'Move using your Speed.'],
  ['free_pilot', 'Free actions on foot', 'Free actions cost no action. Some gear uses them.'], ['sidearm_needed', 'Sidearm Fight', 'Needs a Sidearm weapon.'],
]
for (const [key, name, text] of NOTES) seed.push({ id: `rule_notes_${key}`, name, section: 'notes', text, order: (count.notes = (count.notes ?? 0) + 10) })

add('turn_steps', undefined, C.TURN_STEPS.map((s) => ({ name: s.name, value: s.frequency, gist: s.gist, text: s.text })))
// What a turn step lists is fixed in code, by the step's id.
const STEP_FIXED = new Map(C.TURN_STEPS.map((s) => [`rule_turn_steps_${slug(s.name)}`, { key: s.name, activations: s.activations }]))

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
add('tag_list', undefined, C.TAG_IDS.map((id) => ({ name: id, text: '' })))
const SEED_NUMBERS = { overcharge_heat: C.OVERCHARGE_HEAT, repair_cost: [C.REPAIR_COST] }
add('numbers', undefined, [
  { name: 'Overcharge heat', text: 'Heat for each Overcharge use. The last number repeats.', numbers: SEED_NUMBERS.overcharge_heat },
  { name: 'Repair cost', text: 'Repairs to restore 1 Structure or 1 Stress at a Rest.', numbers: SEED_NUMBERS.repair_cost },
])

// The game-balance numbers owners can edit, one 'rules' row each (id rule_num_<key>, numbers [value]). The database reads the same
// rows with public.rule_number(key, def, lo, hi) (migration 20261122120000), so def/lo/hi here must equal its literals
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
  seed.push({ id: `rule_num_${n.key}`, name: n.label, section: 'numbers', text: n.hint, numbers: [n.def], order: (count.numbers = (count.numbers ?? 0) + 10) })

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

// What the page reads. gameData.ts loadRules() replaces the seed.
export const ruleItems = shallowRef<RuleItem[]>(RULES_SEED)

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
export const fill =(text: string) => text.replaceAll('{HEAT}', String(ruleNumbers('overcharge_heat').at(-1))).replaceAll('{REPAIR}', String(ruleNumbers('repair_cost')[0]))
export const ruleNote = (key: string) => fill(live('notes').find((i) => i.id === `rule_notes_${key}`)?.text ?? '')

// A table row in the shape the page uses: a row with only a name has it as its value.
export type RuleRow = CombatRow & { id: string; group?: string }
const asRow = (i: RuleItem): RuleRow => ({ id: i.id, group: i.group, value: i.value ?? i.name, name: i.value ? i.name : undefined, short: i.short, gist: i.gist, text: fill(i.text), icon: i.icon })
export const ruleRows = (section: string, group?: string) => live(section, group).map(asRow)

export type TurnStep = { id: string; key: string; name: string; activations: string[]; frequency?: string; gist?: string; text: string }
export const turnSteps = (): TurnStep[] => live('turn_steps').map((i) => ({ id: i.id, name: i.name, key: STEP_FIXED.get(i.id)?.key ?? i.id, activations: STEP_FIXED.get(i.id)?.activations ?? [], frequency: i.value, gist: i.gist, text: fill(i.text) }))
export const turnStepText = (key: string) => turnSteps().find((s) => s.key === key)?.text ?? ''

export const ruleTagIds = () => live('tag_list').map((i) => i.name)
export const statusGroups = () => STATUS_CARDS.map((g) => ({ ...g, rows: live('statuses').filter((i) => i.group === g.id || (g.id === 'other' && i.group === 'pilot')).map(asRow) }))
// The Statuses tab's "On foot" card (Pilot mode).
export const onFootRows = (): RuleRow[] => [...ruleRows('statuses', 'pilot'), ...ruleRows('foot', 'on_foot')]
