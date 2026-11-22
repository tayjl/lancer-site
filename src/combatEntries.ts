import type { Info } from './info'
import type { ItemStat } from './itemDetails'
import { OVERCHARGE_HEAT, SCENE_RESOURCES, TURN_STEPS, type CombatAction, type CombatRow } from './combatRules'
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
