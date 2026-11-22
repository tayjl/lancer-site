import { FIGHT, FULL_ACTIONS, IMPROVISED, JOCKEY, OVERCHARGE, PILOT_ACTIONS, PILOT_OVERWATCH, QUICK_ACTIONS, REACTIONS, SCENE_RESOURCES, type CombatAction } from './combatRules'

// The base actions as editable content (content_items kind 'actions'). The combatRules.ts lists are their seed and their
// fallback when none are installed. "mech" and "pilot" say which Combat page modes list them.
export type BaseAction = CombatAction & { id: string; mech: boolean; pilot: boolean }

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
// The activation is part of the id so the two "Activate" actions differ.
const idOf = (a: CombatAction) => {
  if (a === PILOT_OVERWATCH) return 'act_overwatch_pilot' // same name and activation as the mech one
  const activation = a.activation ? slug(a.activation) : ''
  return `act_${slug(a.name)}${activation && activation !== slug(a.name) ? `_${activation}` : ''}`
}

export const SCENE_RESOURCE_IDS = SCENE_RESOURCES.map(idOf)

export const BASE_ACTIONS: BaseAction[] = [
  ...SCENE_RESOURCES.map((a) => ({ a, mech: false })), // read by the turn card, not the action lists
  ...[...QUICK_ACTIONS, ...FULL_ACTIONS, ...REACTIONS, OVERCHARGE, IMPROVISED].map((a) => ({ a, mech: true })),
  ...[FIGHT, JOCKEY, PILOT_OVERWATCH].map((a) => ({ a, mech: false })), // pilot only
].map(({ a, mech }) => ({ ...a, id: idOf(a), mech, pilot: PILOT_ACTIONS.includes(a) }))

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
