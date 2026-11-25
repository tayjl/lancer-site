import { shallowRef } from 'vue'
import { cached } from './catalogue'
import { iconUrl } from './icons'
import { fetchAll, supabase } from './lib/supabaseClient'

// The small game lists the owner can extend (migration 20261124120000_game_definitions.sql): damage types, range types,
// activations, frame uses, frame roles and sizes, weapon types and sizes, mount types (slots and hint), gear, system and deployable types. An item stores the row's id, the label is what people read, and icon and colour (a
// CSS variable NAME from style.css, never a hex) sit in the row's data.
export type DefData = { icon?: string; colour?: string; [key: string]: unknown }
export type Definition = { id: string; label: string; data: DefData; hidden: boolean }
export type DefKind = 'damage_types' | 'range_types' | 'activations' | 'uses' | 'frame_roles' | 'frame_sizes' | 'weapon_types' | 'weapon_sizes'
  | 'mount_types' | 'gear_types' | 'system_types' | 'deployable_types' | 'status_groups'

// Exception to "the database is the only live copy": these lists stay in code as the built-in default, used while loading
// and when the load fails or returns no rows, so the mech sheet never breaks. The migration's seed must equal them (definitions.test.ts).
const def = (id: string, data: DefData = {}): Definition => ({ id, label: id, data, hidden: false })
export const DEFAULT_DEFINITIONS: Record<DefKind, Definition[]> = {
  damage_types: ['Kinetic', 'Energy', 'Explosive', 'Burn', 'Heat', 'Variable'].map((id) => def(id, { icon: id.toLowerCase(), colour: `--dmg-${id.toLowerCase()}` })),
  range_types: ['Range', 'Threat', 'Line', 'Cone', 'Blast', 'Burst'].map((id) => def(id, { icon: id.toLowerCase() })),
  activations: [
    def('Quick', { icon: 'activation_quick', colour: '--act-quick' }),
    def('Full', { icon: 'activation_full', colour: '--act-full' }),
    def('Reaction', { icon: 'reaction', colour: '--act-reaction' }),
    def('Protocol', { icon: 'protocol', colour: '--act-protocol' }),
    def('Free', { icon: 'free_action', colour: '--act-free' }),
    def('Quick Tech', { icon: 'tech_quick', colour: '--act-tech' }),
    def('Full Tech', { icon: 'tech_full', colour: '--act-tech' }),
    def('Invade', { icon: 'tech_quick', colour: '--act-tech' }),
    def('Overcharge', { icon: 'overcharge', colour: '--act-overcharge' }),
  ],
  uses: ['Turn', 'Next Turn', 'Round', 'Next Round', 'Scene', 'Encounter', 'Mission', 'Free'].map((id) => def(id)),
  frame_roles: ['Balanced', 'Striker', 'Defender', 'Support', 'Controller', 'Artillery'].map((id) => def(id)),
  // Ids are the numbers items store, as text.
  frame_sizes: ['0.5', '1', '2', '3'].map((id) => ({ ...def(id), label: id === '0.5' ? '½' : id })),
  weapon_types: ['Rifle', 'Cannon', 'CQB', 'Launcher', 'Melee', 'Nexus'].map((id) => def(id)),
  // Weapon sizes and the sizes a mount takes are one list ("weapon_mounts" in the table's check is not used).
  weapon_sizes: ['Auxiliary', 'Main', 'Heavy', 'Superheavy'].map((id) => def(id)),
  // slots: the weapon sizes each place on the mount takes. Most mounts hold one weapon; Flex, Main/Aux and Aux/Aux hold two.
  mount_types: [
    ['Main', [['Main', 'Auxiliary']], 'Takes one Main or Auxiliary weapon.'],
    ['Heavy', [['Superheavy', 'Heavy', 'Main', 'Auxiliary']], 'Takes one weapon of any size.'],
    // A Superheavy weapon also needs a second, empty mount: see bracingMount() in src/rules.ts.
    ['Superheavy', [['Superheavy']], 'Takes one Superheavy weapon.'],
    ['Flex', [['Main', 'Auxiliary'], ['Auxiliary']], 'Takes one Main or two Auxiliary weapons.'],
    ['Main/Aux', [['Main', 'Auxiliary'], ['Auxiliary']], 'Takes one Main and one Auxiliary weapon.'],
    ['Aux/Aux', [['Auxiliary'], ['Auxiliary']], 'Takes two Auxiliary weapons.'],
    ['Auxiliary', [['Auxiliary']]],
    ['Integrated Auxiliary', [['Auxiliary']]],
  ].map(([id, slots, hint]) => def(id as string, hint ? { slots, hint } : { slots })),
  gear_types: ['Armor', 'Weapon', 'Gear'].map((id) => def(id)),
  system_types: ['System', 'AI', 'Shield', 'Deployable', 'Drone', 'Tech', 'Armor', 'Flight System', 'Integrated'].map((id) => def(id)),
  deployable_types: ['Deployable', 'Drone', 'Mine'].map((id) => def(id)),
  // The combat page's status cards. mode: the page's Mech view shows the card, the Pilot view shows the group's statuses in its On foot card.
  status_groups: [['cover', 'Cover and stealth', 'shield', 'mech'], ['conditions', 'Conditions', 'warning', 'mech'], ['other', 'Other statuses', 'info', 'mech'], ['pilot', 'On foot', 'pilot', 'pilot']]
    .map(([id, label, icon, mode]) => ({ ...def(id, { icon, mode }), label })),
}

// What the Definitions screen of the content editor shows per list: its label, the singular noun, the box it sits in, and the
// fields beyond label, id and hidden. "colours" are the game's own colour variables the list may use (never a hex).
type Colour = { name: string; label: string }
const colours = (prefix: string, names: string[]): Colour[] => names.map((n) => ({ name: `--${prefix}-${n.toLowerCase()}`, label: n }))
export type DefKindInfo = { key: DefKind; label: string; singular: string; box: string; icons?: string[]; colours?: Colour[]; mount?: boolean; modes?: boolean; text?: boolean }
export const DEF_KINDS: DefKindInfo[] = [
  { key: 'damage_types', label: 'Damage types', singular: 'damage type', box: 'Weapons', icons: ['kinetic', 'energy', 'explosive', 'burn', 'heat', 'variable'], colours: colours('dmg', ['Kinetic', 'Energy', 'Explosive', 'Burn', 'Heat', 'Variable']), text: true },
  { key: 'range_types', label: 'Range types', singular: 'range type', box: 'Weapons', icons: ['range', 'threat', 'line', 'cone', 'blast', 'burst'] },
  { key: 'weapon_types', label: 'Weapon types', singular: 'weapon type', box: 'Weapons' },
  { key: 'weapon_sizes', label: 'Weapon sizes', singular: 'weapon size', box: 'Weapons' },
  { key: 'mount_types', label: 'Mount types', singular: 'mount type', box: 'Weapons', mount: true },
  { key: 'frame_roles', label: 'Frame roles', singular: 'frame role', box: 'Mechs' },
  { key: 'frame_sizes', label: 'Frame sizes', singular: 'frame size', box: 'Mechs' },
  { key: 'system_types', label: 'System types', singular: 'system type', box: 'Mechs' },
  { key: 'deployable_types', label: 'Deployable types', singular: 'deployable type', box: 'Mechs' },
  { key: 'activations', label: 'Activations', singular: 'activation', box: 'Actions', icons: ['activation_quick', 'activation_full', 'reaction', 'protocol', 'free_action', 'tech_quick', 'tech_full', 'overcharge'], colours: [...colours('act', ['Quick', 'Full', 'Reaction', 'Protocol', 'Free', 'Overcharge', 'Tech'])] },
  { key: 'uses', label: 'Uses', singular: 'use', box: 'Actions' },
  { key: 'gear_types', label: 'Gear types', singular: 'gear type', box: 'Pilots' },
  { key: 'status_groups', label: 'Status groups', singular: 'status group', box: 'Actions', icons: ['shield', 'warning', 'info', 'pilot'], modes: true },
]
export const DEF_BOXES = ['Weapons', 'Mechs', 'Actions', 'Pilots']
export const defKindInfo = (key: string) => DEF_KINDS.find((k) => k.key === key)

type Row = Definition & { kind: string; sort: number }
// Null until loaded, and after a failed load: then the defaults answer.
export const definitionRows = shallowRef<Row[] | null>(null)

// A kind with no rows at all (not loaded, failed, or never seeded) gives its default. A kind whose rows are all hidden gives none.
function rowsOf(kind: string): Definition[] {
  const own = (definitionRows.value ?? []).filter((row) => row.kind === kind).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  return own.length ? own : (DEFAULT_DEFINITIONS as Record<string, Definition[] | undefined>)[kind] ?? []
}
const same = (a: string, b: unknown) => a.toLowerCase() === String(b ?? '').trim().toLowerCase()

// In sort order. Hidden rows are left out (nobody picks them for new content) unless asked, e.g. to check an item that already uses one.
export const defList = (kind: DefKind | string, withHidden = false) => rowsOf(kind).filter((row) => withHidden || !row.hidden)
export const defIds = (kind: DefKind | string, withHidden = false) => defList(kind, withHidden).map((row) => row.id)
// Ids match whatever the case, since the sheet lower-cases some of them ("kinetic").
const find = (kind: string, id: unknown) => rowsOf(kind).find((row) => same(row.id, id))
export const defLabel = (kind: DefKind | string, id: string) => find(kind, id)?.label ?? id
export const defData = (kind: DefKind | string, id: unknown): DefData => find(kind, id)?.data ?? {}
// "var(--dmg-burn)" for the row's colour, or undefined when it has none or the name isn't a CSS variable name.
export const defColour = (kind: DefKind | string, id: unknown) => {
  const name = defData(kind, id).colour
  return typeof name === 'string' && /^--[\w-]+$/.test(name) ? `var(${name})` : undefined
}
export const defKnown = (kind: DefKind | string, id: unknown) => !!find(kind, id)
// A mount type's places (each the weapon sizes it takes) and its hint, or undefined when the row has none.
export const mountSlots = (mount: unknown): string[][] | undefined => {
  const slots = defData('mount_types', mount).slots
  return Array.isArray(slots) && slots.every(Array.isArray) ? (slots as string[][]) : undefined
}
export const mountHint = (mount: unknown) => {
  const hint = defData('mount_types', mount).hint
  return typeof hint === 'string' ? hint : undefined
}
// A status group's mode: 'pilot' groups show in the Pilot view's On foot card, the others as cards of their own.
export const groupMode = (id: unknown): 'mech' | 'pilot' => (defData('status_groups', id).mode === 'pilot' ? 'pilot' : 'mech')
// A damage type's guide text (before placeholders are filled), or '' when it has none.
export const damageText = (id: unknown) => {
  const text = defData('damage_types', id).text
  return typeof text === 'string' ? text : ''
}
// The row's icon file name when src/assets/icons has it.
export const defIcon = (kind: DefKind | string, id: unknown) => {
  const name = defData(kind, id).icon
  return typeof name === 'string' && iconUrl(name) ? name : undefined
}

// Read once like the other catalogues (invalidateCatalogues makes the next call read again).
export async function loadDefinitions() {
  const { rows, error } = await cached('definitions', () =>
    fetchAll((from, to) => supabase.from('game_definitions').select('kind, id, label, data, sort, hidden').order('kind').order('id').range(from, to)))
  if (error) return
  definitionRows.value = rows.map((row) => ({ ...row, data: (row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {}) as DefData }))
}

// For the editor: every row of one list, hidden ones too, with the updated_at the save is guarded by.
export type DefRow = Definition & { sort: number; updatedAt: string }
export async function loadDefinitionRows(kind: DefKind): Promise<{ rows: DefRow[]; error: string | null }> {
  const { data, error } = await supabase.from('game_definitions').select('id, label, data, sort, hidden, updated_at').eq('kind', kind).order('sort').order('id').limit(200)
  if (error) return { rows: [], error: error.message }
  return { rows: data.map((row) => ({ id: row.id, label: row.label, data: (row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {}) as DefData, sort: row.sort, hidden: row.hidden, updatedAt: row.updated_at })), error: null }
}
// How many entries each list has and how many are hidden, for the editor's list of lists.
export async function loadDefinitionFacts(): Promise<{ facts: Record<string, { entries: number; hidden: number }>; error: string | null }> {
  const { rows, error } = await fetchAll((from, to) => supabase.from('game_definitions').select('kind, id, hidden').order('kind').order('id').range(from, to))
  const facts: Record<string, { entries: number; hidden: number }> = {}
  for (const row of rows) {
    const own = (facts[row.kind] ??= { entries: 0, hidden: 0 })
    own.entries++
    if (row.hidden) own.hidden++
  }
  return { facts, error }
}
