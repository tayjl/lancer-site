import type { Info, InfoCard } from './info'
import { activationOf, type ItemStat } from './itemDetails'
import type { CombatAction, CombatRow } from './combatRules'
import { damageText, defList } from './definitions'
import { fill, onFootRows, ruleNote, ruleNumbers, ruleRows, turnStepText, turnSteps } from './rulesData'
import { plainText } from './rulesText'
import { SCENE_RESOURCE_IDS, baseActions, type BaseAction } from './baseActions'

// One row of a combat guide card (CombatGroup.vue). With "info" it's a button that opens the full information; "plain"
// shows short text as it is; otherwise it's a row that opens in place to show "text".
export type CombatEntry = {
  name?: string
  value?: string
  step?: number
  label?: string
  activation?: string // for the popup's chip. Step cards don't draw it: the card's colour says it.
  activations?: string[]
  frequency?: string
  heat?: string
  cost?: string // what it costs, drawn as a small tag: '1 quick' or '1 full'
  gist?: string
  text?: string
  stats?: ItemStat[]
  tags?: string[]
  tag?: string // the name drawn as a chip
  icon?: string
  plain?: boolean
  mod?: boolean
  group?: string // a sub-label the card's chips sit under (the Frame card)
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
  gist: options.gist === false ? undefined : (row.gist ? fill(row.gist) : firstSentence(row.text)),
  text: row.text,
  icon: row.icon,
})

export const plainEntry = (text: string, value?: string): CombatEntry => ({ plain: true, value, text })

// An action with its placeholders filled in (another action's name, a number).
const filled = (a: BaseAction): BaseAction => ({ ...a, text: fill(a.text) })
const sceneResources = () => baseActions.value.filter((a) => SCENE_RESOURCE_IDS.includes(a.id)).map(filled)

// "Your turn" and "Scene resources". The overcharge cost and the Speed come from your mech when it has a frame.
// A pilot on foot has no protocol or overcharge, so those two steps are left out.
export function turnEntries(speed: number | null, overcharge: string | null, pilot = false) {
  const steps = turnSteps().filter((step) => !pilot || (step.key !== 'Protocol' && step.key !== 'Overcharge')).map((step, i): CombatEntry => ({
    step: i + 1,
    activations: step.activations,
    name: step.activations.length ? undefined : step.name,
    frequency: step.key === 'Movement' && speed !== null ? `Speed ${speed}` : step.frequency,
    heat: step.key === 'Overcharge' ? (overcharge ?? defaultHeat()) : undefined,
    gist: step.gist,
    text: step.activations.some((a) => a === 'Full' || a === 'Quick') ? `<b>${step.name}.</b> ${step.text}` : step.text,
  }))
  return { steps, resources: sceneResources().map(actionEntry) }
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
  const colour = activationOf(activation)?.colour.replace(/^--act-/, '')
  return !colour || colour.startsWith('--') || colour === 'overcharge' ? 'free' : colour
}

// One card of a turn step. "colour" is the card's activation colour key (quick, full, tech, protocol, overcharge, free,
// reaction), left out for a neutral card. "text" is a short how-it-works rule, "heat" the Overcharge track, and "empty"
// the one line an empty card shows so it keeps its place.
export type StepGroup = {
  title: string
  colour?: string
  text?: string
  heat?: { steps: string[]; custom: boolean } // the mech's own steps when it has a frame, else the defaults; custom when they differ
  entries: CombatEntry[]
  empty?: string
}

export type KitAction = CombatEntry & { key: string; block: string }
const GROUPS = [['attack', 'Attacks', 'No attacks.'], ['tech', 'Tech', 'No tech actions.'], ['other', 'Other', 'No other actions.']] as const
const STEP_ACTIVATIONS: Record<string, string[]> = { '1 full': ['full', 'full tech'], '2 quick': ['quick', 'quick tech', 'invade'] }
const defaultHeat = () => ruleNumbers('overcharge_heat').join(' → ')

// One turn step's cards. Kit actions are your gear's own (a system's, a talent's). "overcharge" is your mech's Heat track,
// when it has a frame. Empty cards stay, with their "empty" line. An unknown step has none.
// "sidearm": the pilot has a Sidearm weapon equipped, so Fight is a Quick action too.
export function stepActions(stepName: string, kitActions: KitAction[], pilot = false, overcharge: string | null = null, sidearm = false): StepGroup[] {
  const general: CombatAction[] = baseActions.value.filter((a) => (pilot ? a.pilot : a.mech)).map(filled)
  const fight = pilot && sidearm ? general.find((a) => a.name === 'Fight') : undefined
  if (fight) general.push({ ...fight, activation: 'Quick', group: 'attack', gist: undefined, text: `${fight.text}<br>${ruleNote('sidearm_needed')}` })
  // A pilot on foot only has the actions on their gear.
  const kit = (keep: (e: KitAction) => boolean) => kitActions.filter((e) => keep(e) && (pilot ? e.block === 'gear' : e.block !== 'gear'))
  // An action with no activation (Core power rules) is a Rules topic, not a step action.
  const keyed = (key: string) => general.filter((a) => a.activation && actionKey(a.activation) === key && !a.group && a.activation !== 'Overcharge').map(actionEntry)
  const how = (text: string, colour?: string): StepGroup => ({ title: 'How it works', colour, text, entries: [] })
  const activation = (a: { activation?: string }) => (a.activation ?? '').toLowerCase()
  const isTech = (e: { activation?: string }) => ['quick tech', 'full tech', 'invade'].includes(activation(e))

  const activations = STEP_ACTIVATIONS[stepName]
  if (activations) {
    const colour = stepName === '1 full' ? 'full' : 'quick'
    return [
      ...GROUPS.map(([group, title, empty]): StepGroup => ({
        title, empty, colour: group === 'tech' ? 'tech' : colour, ...(group === 'tech' && !pilot && { text: ruleNote('tech') }),
        // Kit tech actions (a system's or a piece of gear's) sit in the Tech card, so it is never empty beside them.
        entries: [
          ...general.filter((a) => (a.group === group || (group === 'other' && !a.group)) && activations.includes(activation(a))).map(actionEntry),
          ...(group === 'tech' ? kit((e) => activations.includes(activation(e)) && isTech(e)) : []),
        ],
      })),
      { title: 'Your kit', colour, empty: 'No kit actions.', entries: kit((e) => activations.includes(activation(e)) && !isTech(e)) },
    ]
  }
  switch (stepName) {
    case 'Protocol': return [how(turnStepText('Protocol'), 'protocol'), { title: 'Protocols', colour: 'protocol', empty: 'No protocols.', entries: kit((e) => e.key === 'protocol') }]
    case 'Movement': return [
      { title: 'How it works', text: turnStepText('Movement'), entries: ruleRows('movement', 'gateway').map((row) => rowEntry(row, { column: true })) },
      { title: 'Move further', entries: general.filter((a) => a.group === 'move').map((a) => ({ ...actionEntry(a), cost: `1 ${activation(a)}` })) },
    ]
    case 'Overcharge': {
      if (pilot) return []
      const track = overcharge ?? defaultHeat()
      return [
        how(general.find((a) => a.activation === 'Overcharge')?.text ?? '', 'overcharge'),
        { title: 'Heat', colour: 'overcharge', entries: kit((e) => activation(e) === 'overcharge'), heat: { steps: track.split(' → '), custom: track !== defaultHeat() } },
      ]
    }
    case 'Free': return [how(turnStepText('Free'), 'free'), { title: 'Free actions', colour: 'free', empty: 'No free actions.', entries: [...keyed('free'), ...kit((e) => e.key === 'free' && activation(e) !== 'overcharge')] }]
    case 'Reaction': return [how(`${turnStepText('Reaction')} ${ruleNote('reactions')}`, 'reaction'), { title: 'Reactions', colour: 'reaction', empty: 'No reactions.', entries: [...keyed('reaction'), ...kit((e) => e.key === 'reaction')] }]
    default: return []
  }
}

// The Rules section's chips. Each opens a popup of stacked cards, so tables become cards and InfoDialog needs no change.
// "text" is the topic's plain words, for search.
export type Topic = { name: string; info: () => Info; text: string }
export type TopicCard = { title: string; icon: string; topics: Topic[] }

const note = (html: string, heading = ''): InfoCard => ({ heading, html })
const rowCards = (rows: CombatRow[], withValue = false): InfoCard[] =>
  rows.map((row) => ({ heading: withValue && row.name ? `${row.name} (${row.value})` : (row.name ?? row.value), html: row.text }))
const topic = (name: string, cards: InfoCard[]): Topic => ({
  name,
  info: () => ({ kind: 'Rule', name, facts: [], stats: [], groups: [{ stack: true, cards }] }),
  text: plainText([name, ...cards.map((c) => `${c.heading} ${c.html}`)].join(' ')),
})
const topics = (rows: CombatRow[]) => rows.map((r) => topic(r.value, rowCards([r])))

// Every visible damage type, with its guide text when it has one.
const damageTypesHtml = () => defList('damage_types').map((t) => { const text = damageText(t.id); return text ? `<b>${t.label}:</b> ${fill(text)}` : `<b>${t.label}</b>` }).join('<br>')

// "pilot" trims it to what a pilot on foot uses. "repairLine" is the mech's own Repair cost line, when it has one.
export function rulesTopics(pilot: boolean, repairLine?: string): TopicCard[] {
  const core = baseActions.value.map(filled).find((a) => a.id === 'act_core_power_rules')
  const rows = ruleRows
  return [
    { title: 'Checks and resources', icon: 'star', topics: [
      topic('Checks and saves', rowCards([...rows('checks', 'formula'), ...rows('checks', 'result')])),
      ...sceneResources().map((r) => topic(r.name, [{ heading: r.frequency ?? '', html: r.text }, note(ruleNote('resources'))])),
      ...(core && !pilot ? [topic('Core power', [{ heading: core.frequency ?? '', html: core.text }])] : []),
      topic('Pushing through', [note(ruleNote('pushing'))]),
      ...(pilot ? [topic('Pilot checks', [note(ruleNote('pilot_checks')), ...rowCards(rows('checks', 'dc'))])] : []),
    ] },
    { title: 'Attacks and damage', icon: 'crosshair', topics: [
      topic('Attack totals', rowCards(rows('attacks', 'formula'))),
      topic('Results', [note(ruleNote('results')), ...rowCards(rows('attacks', 'result'))]),
      topic('Damage', [{ heading: 'Damage types', html: damageTypesHtml() }, ...rowCards(rows('attacks', 'damage_formula'))]),
      ...(pilot ? [] : [
        topic('Dice conversions', [
          note(`${ruleNote('conversions')} ${ruleNote('dice')}`),
          { heading: 'Dice', html: rows('dice', 'dice').map((d) => `${d.value}: ${d.text}`).join('<br>') },
          { heading: 'Recharge', html: rows('dice', 'recharge').map((r) => `${r.value}: ${r.text}`).join('<br>') },
        ]),
        topic('Defence baselines', rowCards(rows('attacks', 'defence'))),
      ]),
      ...topics(rows('attacks', 'extra')),
      ...(pilot ? topics(rows('foot', 'attacks')) : []),
    ] },
    { title: 'Movement and range', icon: 'speed', topics: [
      topic('Speed', [note(ruleNote('movement')), ...rowCards(rows('movement', 'gateway'), true)]),
      topic('Terrain', rowCards(rows('movement', 'terrain'))),
      topic('Knockback', [note(ruleNote('knockback')), ...rowCards(rows('movement', 'knockback'))]),
      topic('Areas', rowCards(rows('range', 'area'))),
      topic('Range', rowCards(rows('range', 'tier'), true)),
      topic('Sensors', [note(ruleNote('sensors')), ...rowCards(rows('range', 'sensor'), true)]),
      topic('Auras', [note(ruleNote('auras')), ...rowCards(rows('range', 'aura'))]),
      topic('Range and Threat bonuses', rowCards(rows('range', 'bonus'))),
      topic('Range in talents', rowCards(rows('range', 'talent'))),
      topic('Cover', [note(ruleNote('cover'))]),
    ] },
    { title: 'Structure and repairs', icon: 'structure', topics: pilot
      ? [...topics(rows('foot', 'stats')), ...topics(onFootRows())]
      : [
        topic('Structure and stress', [...rowCards([...rows('structure', 'trigger'), ...rows('structure', 'step')]), note(ruleNote('structure'), 'Nothing left to destroy')]),
        ...rows('structure', 'repair').map((r) => topic(r.value, [...rowCards([r]), ...(r.id === 'rule_structure_rest' && repairLine ? [note(repairLine)] : [])])),
        topic('Pilots and drones', [...rowCards(rows('foot')), note(ruleNote('drones')), note(ruleNote('size'))]),
      ] },
  ]
}
