import type { Info, InfoCard } from './info'
import { activationOf, type ItemStat } from './itemDetails'
import {
  ATTACK_EXTRAS, ATTACK_FORMULAS, ATTACK_RESULTS, AREAS, AURAS, AURAS_NOTE, CHECK_FORMULAS, CHECK_RESULTS, CONVERSIONS_NOTE, COVER_NOTE, DAMAGE_FORMULAS, DAMAGE_TYPES, DEFENCES, DICE, DICE_NOTE,
  DRONES_NOTE, FOOT_RULES, KNOCKBACK, KNOCKBACK_NOTE, MOVEMENT_NOTE, ON_FOOT_ROWS, OVERCHARGE, OVERCHARGE_HEAT, OVERCHARGE_LATER,
  PILOT_CHECKS_NOTE, PILOT_DCS, PUSHING_THROUGH, RANGE_BONUSES, RANGE_TALENTS, RANGE_TIERS, REACTIONS_NOTE, RECHARGE, REPAIRS, RESOURCES_NOTE, RESULTS_NOTE,
  SENSORS, SENSORS_NOTE, SIZE_NOTE, SPEED_GATEWAYS, STRUCTURE_NOTE, STRUCTURE_STRESS, STRUCTURE_TRIGGERS, TECH_NOTE, TERRAIN, TURN_STEPS,
  type CombatAction, type CombatFormula, type CombatRow,
} from './combatRules'
import { plainText } from './rulesText'
import { SCENE_RESOURCE_IDS } from './baseActions'
import { baseActions } from './gameData'

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
  gist: options.gist === false ? undefined : (row.gist ?? firstSentence(row.text)),
  text: row.text,
  icon: row.icon,
})

export const plainEntry = (text: string, value?: string): CombatEntry => ({ plain: true, value, text })

const sceneResources = () => baseActions.value.filter((a) => SCENE_RESOURCE_IDS.includes(a.id))

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
    text: step.activations.some((a) => a === 'Full' || a === 'Quick') ? `<b>${step.name}.</b> ${step.text}` : (onFoot(step, step.text) as string),
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
  const colour = activationOf(activation)?.colour
  return !colour || colour === 'overcharge' ? 'free' : colour
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
const DEFAULT_HEAT = OVERCHARGE_HEAT.map(String).join(' → ')

// One turn step's cards. Kit actions are your gear's own (a system's, a talent's). "overcharge" is your mech's Heat track,
// when it has a frame. Empty cards stay, with their "empty" line. An unknown step has none.
// "sidearm": the pilot has a Sidearm weapon equipped, so Fight is a Quick action too.
export function stepActions(stepName: string, kitActions: KitAction[], pilot = false, overcharge: string | null = null, sidearm = false): StepGroup[] {
  const general: CombatAction[] = baseActions.value.filter((a) => (pilot ? a.pilot : a.mech))
  const fight = pilot && sidearm ? general.find((a) => a.name === 'Fight') : undefined
  if (fight) general.push({ ...fight, activation: 'Quick', group: 'attack', gist: undefined, text: `${fight.text}<br>Needs a Sidearm weapon.` })
  // A pilot on foot only has the actions on their gear.
  const kit = (keep: (e: KitAction) => boolean) => kitActions.filter((e) => keep(e) && (pilot ? e.block === 'gear' : e.block !== 'gear'))
  // An action with no activation (Core power rules) is a Rules topic, not a step action.
  const keyed = (key: string) => general.filter((a) => a.activation && actionKey(a.activation) === key && !a.group && a.activation !== 'Overcharge').map(actionEntry)
  const how = (text: string, colour?: string): StepGroup => ({ title: 'How it works', colour, text, entries: [] })
  const activation = (a: { activation?: string }) => (a.activation ?? '').toLowerCase()

  const activations = STEP_ACTIVATIONS[stepName]
  if (activations) {
    const colour = stepName === '1 full' ? 'full' : 'quick'
    return [
      ...GROUPS.map(([group, title, empty]): StepGroup => ({
        title, empty, colour: group === 'tech' ? 'tech' : colour, ...(group === 'tech' && !pilot && { text: TECH_NOTE }),
        entries: general.filter((a) => (a.group === group || (group === 'other' && !a.group)) && activations.includes(activation(a))).map(actionEntry),
      })),
      { title: 'Your kit', colour, empty: 'No kit actions.', entries: kit((e) => activations.includes(activation(e))) },
    ]
  }
  switch (stepName) {
    case 'Protocol': return [how(TURN_STEPS[0].text, 'protocol'), { title: 'Protocols', colour: 'protocol', empty: 'No protocols.', entries: kit((e) => e.key === 'protocol') }]
    case 'Movement': return [
      { title: 'How it works', text: 'Move up to your Speed.', entries: SPEED_GATEWAYS.map((row) => rowEntry(row, { column: true })) },
      { title: 'Move further', entries: general.filter((a) => a.group === 'move').map((a) => ({ ...actionEntry(a), cost: `1 ${activation(a)}` })) },
    ]
    case 'Overcharge': {
      if (pilot) return []
      const track = overcharge ?? DEFAULT_HEAT
      return [
        how(`${(general.find((a) => a.activation === 'Overcharge') ?? OVERCHARGE).text}<br>${OVERCHARGE_LATER}`, 'overcharge'),
        { title: 'Heat', colour: 'overcharge', entries: kit((e) => activation(e) === 'overcharge'), heat: { steps: track.split(' → '), custom: track !== DEFAULT_HEAT } },
      ]
    }
    case 'Free': return [how(pilot ? 'Free actions cost no action. Some gear uses them.' : TURN_STEPS.find((s) => s.name === 'Free')!.text, 'free'), { title: 'Free actions', colour: 'free', empty: 'No free actions.', entries: [...keyed('free'), ...kit((e) => e.key === 'free' && activation(e) !== 'overcharge')] }]
    case 'Reaction': return [how(REACTIONS_NOTE, 'reaction'), { title: 'Reactions', colour: 'reaction', empty: 'No reactions.', entries: [...keyed('reaction'), ...kit((e) => e.key === 'reaction')] }]
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
const formulaCards = (formulas: CombatFormula[]): InfoCard[] =>
  formulas.map((f) => ({ heading: f.formula, html: [f.note, `Example: ${f.example}`].filter(Boolean).join('<br>') }))
const topic = (name: string, cards: InfoCard[]): Topic => ({
  name,
  info: () => ({ kind: 'Rule', name, facts: [], stats: [], groups: [{ stack: true, cards }] }),
  text: plainText([name, ...cards.map((c) => `${c.heading} ${c.html}`)].join(' ')),
})
const ofRow = (rows: CombatRow[], ...names: string[]) => names.map((n) => topic(n, rowCards(rows.filter((r) => r.value === n))))

// "pilot" trims it to what a pilot on foot uses. "repairLine" is the mech's own Repair cost line, when it has one.
export function rulesTopics(pilot: boolean, repairLine?: string): TopicCard[] {
  const results = ATTACK_RESULTS.map((r): InfoCard => ({
    heading: r.margin,
    html: [r.note ? `${r.note}.` : '', `<b>${r.physical[0]}:</b> ${r.physical[1]}`, `<b>${r.tech[0]}:</b> ${r.tech[1]}`].filter(Boolean).join('<br>'),
  }))
  const structure = STRUCTURE_STRESS.map((s): InfoCard => ({ heading: `Step ${s.n}`, html: `<b>Structure:</b> ${s.structure}<br><b>Stress:</b> ${s.stress}` }))
  const core = baseActions.value.find((a) => a.id === 'act_core_power_rules')
  const prefixed = (rows: CombatRow[], word: string) => rowCards(rows.map((r) => ({ ...r, value: `${word} ${r.value}` })))
  return [
    { title: 'Checks and resources', icon: 'star', topics: [
      topic('Checks and saves', [...formulaCards(CHECK_FORMULAS), ...rowCards(CHECK_RESULTS)]),
      ...sceneResources().map((r) => topic(r.name, [{ heading: r.frequency ?? '', html: r.text }, note(RESOURCES_NOTE)])),
      ...(core && !pilot ? [topic('Core power', [{ heading: core.frequency ?? '', html: core.text }])] : []),
      topic('Pushing through', [note(PUSHING_THROUGH)]),
      ...(pilot ? [topic('Pilot checks', [note(PILOT_CHECKS_NOTE), ...prefixed(PILOT_DCS, 'DC')])] : []),
    ] },
    { title: 'Attacks and damage', icon: 'crosshair', topics: [
      topic('Attack totals', formulaCards(ATTACK_FORMULAS)),
      topic('Results', [note(RESULTS_NOTE), ...results]),
      topic('Damage', [{ heading: 'Damage types', html: DAMAGE_TYPES.map((t) => t.name).join(', ') }, ...formulaCards(DAMAGE_FORMULAS)]),
      ...(pilot ? [] : [
        topic('Dice conversions', [
          note(`${CONVERSIONS_NOTE} ${DICE_NOTE}`),
          { heading: 'Dice', html: DICE.map((d) => `${d.value}: ${d.text}`).join('<br>') },
          { heading: 'Recharge', html: RECHARGE.map((r) => `${r.value}: ${r.text}`).join('<br>') },
        ]),
        topic('Defence baselines', DEFENCES.map((d) => ({ heading: d.mech, html: `Evasion ${d.evasion}<br>E-defence ${d.edef}` }))),
      ]),
      ...ofRow(ATTACK_EXTRAS, 'Grit', 'Bonus damage', 'Damage resistance', 'Heat as damage'),
      ...(pilot ? ofRow(FOOT_RULES, 'Pilot attacks', 'Attacks on a pilot') : []),
    ] },
    { title: 'Movement and range', icon: 'speed', topics: [
      topic('Speed', [note(MOVEMENT_NOTE), ...rowCards(SPEED_GATEWAYS, true)]),
      topic('Terrain', rowCards(TERRAIN)),
      topic('Knockback', [note(KNOCKBACK_NOTE), ...prefixed(KNOCKBACK, 'Knockback')]),
      topic('Areas', rowCards(AREAS)),
      topic('Range', rowCards(RANGE_TIERS, true)),
      topic('Sensors', [note(SENSORS_NOTE), ...rowCards(SENSORS, true)]),
      topic('Auras', [note(AURAS_NOTE), ...prefixed(AURAS, 'Aura')]),
      topic('Range and Threat bonuses', rowCards(RANGE_BONUSES)),
      topic('Range in talents', rowCards(RANGE_TALENTS)),
      topic('Cover', [note(COVER_NOTE)]),
    ] },
    { title: 'Structure and repairs', icon: 'structure', topics: pilot
      ? [...ofRow(FOOT_RULES, 'Pilot stats', 'Pilot gear'), ...ON_FOOT_ROWS.map((r) => topic(r.value, rowCards([r])))]
      : [
        topic('Structure and stress', [...STRUCTURE_TRIGGERS.map((t) => ({ heading: t.name, html: t.text })), ...structure, note(STRUCTURE_NOTE, 'Nothing left to destroy')]),
        topic('Rest', [...rowCards(REPAIRS.filter((r) => r.value === 'Rest')), ...(repairLine ? [note(repairLine)] : [])]),
        topic('Full Repair', rowCards(REPAIRS.filter((r) => r.value === 'Full Repair'))),
        topic('Pilots and drones', [...rowCards(FOOT_RULES), note(DRONES_NOTE), note(SIZE_NOTE)]),
      ] },
  ]
}
