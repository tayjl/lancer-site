import type { Info } from './info'
import { activationOf, type ItemStat } from './itemDetails'
import { FULL_ACTIONS, IMPROVISED, JOCKEY, OVERCHARGE, OVERCHARGE_HEAT, OVERCHARGE_LATER, PILOT_ACTIONS, QUICK_ACTIONS, REACTIONS, SCENE_RESOURCES, TURN_STEPS, type ActionGroup, type CombatAction, type CombatRow } from './combatRules'
import { plainText } from './rulesText'

// One row of a combat guide card (CombatGroup.vue). With "info" it's a button that opens the full information; "plain"
// shows short text as it is; otherwise it's a row that opens in place to show "text".
export type CombatEntry = {
  name?: string
  value?: string
  step?: number
  label?: string
  activation?: string
  activations?: string[]
  frequency?: string
  heat?: string
  gist?: string
  text?: string
  stats?: ItemStat[]
  tags?: string[]
  tag?: string // the name drawn as a chip
  icon?: string
  plain?: boolean
  mod?: boolean
  open?: boolean
  info?: () => Info
}

// An action's "Trigger: … Effect: …" shows its effect only.
export const firstSentence = (text: string) => plainText(text).replace(/^Trigger:.*?Effect:\s*/, '').split(/(?<=\.)\s/)[0]

export const actionEntry = (a: CombatAction): CombatEntry => ({ name: a.name, activation: a.activation, frequency: a.frequency, gist: a.gist ?? firstSentence(a.text), text: a.text })

// A table row as a list row. By default its value is its name (a status, a tag); "column" puts a short value before the
// name (a Speed gateway, a range), and "gist: false" leaves the gist out where the name already says it.
export const rowEntry = (row: CombatRow, options: { column?: boolean; gist?: boolean } = {}): CombatEntry => ({
  ...(options.column ? { value: row.short ?? row.value, name: row.name } : { name: row.value }),
  gist: options.gist === false ? undefined : (row.gist ?? firstSentence(row.text)),
  text: row.text,
  icon: row.icon,
})

export const plainEntry = (text: string, value?: string): CombatEntry => ({ plain: true, value, text })

// "Your turn" and "Scene resources". The overcharge cost and the Speed come from your mech when it has a frame.
// A pilot on foot has no protocol or overcharge, so those two steps are left out.
export function turnEntries(speed: number | null, overcharge: string | null, pilot = false) {
  const onFoot = (step: (typeof TURN_STEPS)[number], text?: string) => (pilot && step.name === 'Movement' ? 'Move using your Speed.' : text)
  const steps = TURN_STEPS.filter((step) => !pilot || (step.name !== 'Protocol' && step.name !== 'Overcharge')).map((step, i): CombatEntry => ({
    step: i + 1,
    activations: step.activations,
    name: step.activations.length ? undefined : step.name,
    frequency: step.name === 'Movement' && speed !== null ? `Speed ${speed}` : step.frequency,
    heat: step.name === 'Overcharge' ? (overcharge ?? OVERCHARGE_HEAT.join(' → ')) : undefined,
    gist: onFoot(step, step.gist),
    text: step.activations.includes('Full') ? `<b>${step.name}.</b> ${step.text}` : (onFoot(step, step.text) as string),
  }))
  return { steps, resources: SCENE_RESOURCES.map(actionEntry) }
}

// What a chip opens: the entry's own info (kit items), or its rules text built the way a kit trait's is.
export const entryInfo = (entry: CombatEntry, kind: string): Info =>
  entry.info?.() ?? {
    kind,
    name: entry.name ?? entry.value ?? entry.tag ?? '',
    facts: [],
    stats: [],
    groups: [{ cards: [{ heading: '', html: entry.text ?? '', activation: entry.activation }] }],
  }

// Which kind of action an activation is: its chip colour, with Overcharge and a power with no chip (Core Power) as 'free'.
export const actionKey = (activation?: string) => {
  const colour = activationOf(activation)?.colour
  return !colour || colour === 'overcharge' ? 'free' : colour
}

// One turn step's actions as titled groups, empty ones left out. Kit actions are your gear's own (a system's, a talent's).
// "overcharge" is your mech's Heat cost text, when it has a frame.
export type KitAction = CombatEntry & { key: string; block: string }
const GROUPS: [ActionGroup, string][] = [['attack', 'Attacks'], ['move', 'Movement'], ['tech', 'Tech'], ['systems', 'Systems'], ['mech', 'Your mech']]
export function stepActions(stepName: string, kitActions: KitAction[], pilot = false, overcharge: string | null = null): { title: string; entries: CombatEntry[] }[] {
  const general: CombatAction[] = pilot ? PILOT_ACTIONS : [...QUICK_ACTIONS, ...FULL_ACTIONS, IMPROVISED, JOCKEY, OVERCHARGE, ...REACTIONS]
  // A pilot on foot only has the actions on their gear.
  const kit = (...keys: string[]) => kitActions.filter((e) => keys.includes(e.key) && (!pilot || e.block === 'gear'))
  const entry = (a: CombatAction) =>
    a === OVERCHARGE ? { ...actionEntry(a), heat: overcharge ?? OVERCHARGE_HEAT.join(' → '), text: `${a.text}<br>${OVERCHARGE_LATER}` } : actionEntry(a)
  const keyed = (key: string) => general.filter((a) => actionKey(a.activation) === key && !a.group).map(entry)
  const named = (...names: string[]) => general.filter((a) => names.includes(a.name)).map(entry)
  const groups = (list: { title: string; entries: CombatEntry[] }[]) => list.filter((g) => g.entries.length)

  switch (stepName) {
    case 'Protocol': return groups([{ title: 'Protocols', entries: kit('protocol') }])
    case 'Movement': return groups([{ title: 'Movement', entries: named('Boost', 'Disengage') }])
    case 'Overcharge': return groups([{ title: 'Overcharge', entries: general.filter((a) => a === OVERCHARGE).map(entry) }])
    case 'Free': return groups([{ title: 'Free actions', entries: [...keyed('free').filter((e) => e.name !== OVERCHARGE.name), ...kit('free')] }])
    case 'Reaction': return groups([{ title: 'Reactions', entries: [...keyed('reaction'), ...kit('reaction')] }])
    case '1 full action or 2 quick actions': return groups([
      ...GROUPS.map(([group, title]) => ({ title, entries: general.filter((a) => a.group === group).map(entry) })),
      { title: 'Your kit', entries: kit('quick', 'full', 'tech') },
    ])
    default: return []
  }
}
