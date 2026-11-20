import armourIcon from './assets/icons/armour.svg'
import blastIcon from './assets/icons/blast.svg'
import burnIcon from './assets/icons/burn.svg'
import burstIcon from './assets/icons/burst.svg'
import coneIcon from './assets/icons/cone.svg'
import eDefIcon from './assets/icons/e_def.svg'
import energyIcon from './assets/icons/energy.svg'
import explosiveIcon from './assets/icons/explosive.svg'
import heatIcon from './assets/icons/heat.svg'
import hpIcon from './assets/icons/hp.svg'
import kineticIcon from './assets/icons/kinetic.svg'
import lineIcon from './assets/icons/line.svg'
import rangeIcon from './assets/icons/range.svg'
import systemPointIcon from './assets/icons/system_point.svg'
import speedIcon from './assets/icons/speed.svg'
import threatIcon from './assets/icons/threat.svg'
import thrownIcon from './assets/icons/thrown.svg'
import variableIcon from './assets/icons/variable.svg'
import { hiddenTags, type Item } from './gameData'
import { licenceNames } from './mechData'
import { rankName } from './rules'
import { flatDamage, flatDamageText } from './damage'
import { plainText } from './rulesText'
import { capitalise } from './text'

// A stat value for display: 0.5 is shown as ½, a missing one as a dash.
export const half = (value: number | null) => (value === 0.5 ? '½' : String(value ?? '-'))

// What an item card shows (ItemDetails.vue, and the pickers' one-line summaries): its stats with LANCER's
// symbols, its rules text and its tags.

// Armour bonuses: [label, icon].
const BONUSES: Record<string, [string, string | null]> = {
  pilot_armor: ['Armour', armourIcon],
  pilot_hp: ['HP', hpIcon],
  pilot_edef: ['E-defence', eDefIcon],
  pilot_speed: ['Speed', speedIcon],
}
// Weapon range and damage types, lower case.
const ICONS: Record<string, string> = {
  threat: threatIcon,
  thrown: thrownIcon,
  range: rangeIcon,
  burst: burstIcon,
  blast: blastIcon,
  line: lineIcon,
  cone: coneIcon,
  kinetic: kineticIcon,
  energy: energyIcon,
  explosive: explosiveIcon,
  burn: burnIcon,
  heat: heatIcon,
  variable: variableIcon,
}
// The symbol for a range or damage type ("Range", "Kinetic"), or null.
export const symbolOf = (type: string) => ICONS[type.toLowerCase()] ?? null
// Tags that only repeat what the slot already says.
const HIDDEN_TAGS = ['tg_gear', 'tg_pilot_weapon', 'tg_personal_armor']

// A range or damage list (an item's, or one of its actions'), as stats with symbols. Damage is the flat homebrew
// number (damage.ts).
type Entry = { type?: unknown; val: string | number }
export type ItemStat = { kind?: string; label: string; icon: string | null; value: string }
const entryStats = (kind: 'range' | 'damage', entries: Entry[]): ItemStat[] =>
  entries.map((entry) => ({
    kind,
    label: String(entry.type ?? '').toLowerCase(),
    icon: ICONS[String(entry.type ?? '').toLowerCase()] ?? null,
    value: String(kind === 'damage' ? flatDamage(entry.val) : entry.val),
  }))

// A tag as the card shows it: lancer-data's name with its value filled in ("limited 3"), lower case.
export function tagLabel(tag: { id: string; val?: unknown }, tagNames: Map<string, string>): string {
  const name = tagNames.get(tag.id) ?? tag.id.replace(/^tg_/, '').replaceAll('_', ' ')
  return (name.includes('{VAL}') ? name.replace('{VAL}', String(tag.val ?? '')) : `${name}${tag.val != null ? ` ${tag.val}` : ''}`).trim().toLowerCase()
}
// The tags worth showing: not the ones that only repeat the slot or are hidden by the packs.
export const visibleTags = (item: Item) => item.tags.filter((tag) => !HIDDEN_TAGS.includes(tag.id) && !hiddenTags.value.has(tag.id))

// Each stat's "kind" (bonus, range, damage or sp) lets the archives' rows put them in columns.
// "tagNames" is lancer-data's tag list (e.g. "Limited {VAL}"); without it the id stands in ("limited").
export function itemDetails(item: Item, tagNames: Map<string, string>) {
  const stats: ItemStat[] = [
    ...item.bonuses.filter(bonus => bonus.id !== 'pilot_evasion').map((bonus) => {
      const [label, icon] = BONUSES[bonus.id] ?? [bonus.id.replace('pilot_', ''), null]
      return { kind: 'bonus', label, icon, value: bonus.id === 'pilot_hp' && !bonus.replace ? `+${bonus.val}` : String(bonus.val) }
    }),
    ...entryStats('range', item.range),
    ...entryStats('damage', item.damage),
    ...(item.sp ? [{ kind: 'sp', label: 'sp', icon: systemPointIcon, value: String(item.sp) }] : []),
  ]
  const tags = visibleTags(item).map((tag) => tagLabel(tag, tagNames))
  // Pilot gear often has no rules text, only flavour, so it falls back to the description.
  // Still formatted HTML: RulesText.vue draws it safely, plainText() flattens it for pickers.
  const text = flatDamageText(plainText(item.effect) ? item.effect : item.type === 'Gear' ? item.description : '')
  return { stats, tags, text }
}

// An item card's look (ItemCard.vue): its header colour (a --type-* token) and its symbol (src/assets/icons).
export type CardType = 'weapon' | 'system' | 'frame' | 'pilot' | 'talent' | 'core'
const PILOT_TYPES = ['Armor', 'Gear']
export function itemCard(item: Item): { type: CardType; icon: string } {
  if (item.type === 'Mod') return { type: 'system', icon: 'mod' }
  if (item.mount || item.type === 'Weapon') return { type: 'weapon', icon: item.type === 'Melee' ? 'melee' : 'weapon' }
  const has = (tag: string) => item.tags.some((t) => t.id === tag)
  const icon = has('tg_grenade') ? 'grenade' : has('tg_mine') ? 'mine' : item.type === 'Drone' || has('tg_drone') ? 'drone'
    : item.type === 'Deployable' || has('tg_deployable') ? 'deployable' : null
  return PILOT_TYPES.includes(item.type) ? { type: 'pilot', icon: icon ?? 'generic_item' } : { type: 'system', icon: icon ?? 'system' }
}

// The facts line on a mech weapon's or system's card: the licence rank that unlocks it ("IPS-N Blackbeard II"), or
// its maker when it needs none ("GMS"), then its mount and type ("Main Melee"). Pilot gear has none: its slot says.
export function itemFacts(item: Item): string[] {
  if (PILOT_TYPES.includes(item.type) || (item.type === 'Weapon' && !item.mount)) return []
  const source = typeof item.raw?.source === 'string' ? item.raw.source : ''
  const licence = item.licenceLevel > 0 ? `${licenceNames.value.get(item.licenceId) ?? item.licenceId} ${rankName(item.licenceLevel)}` : source
  if (item.type === 'Mod') return [licence, `Mod for ${(Array.isArray(item.raw?.allowed_types) ? item.raw.allowed_types : []).join(', ') || 'any weapon'}`]
  return [licence, item.mount ? `${item.mount} ${item.type}`.trim() : item.type === 'System' ? '' : item.type].filter(Boolean)
}

// LANCER's activations, for ActionChip.vue: each with its --act-* colour and its symbol. "None" (passive) and
// anything unknown get no chip.
const ACTIVATIONS: Record<string, { colour: string; icon: string }> = {
  quick: { colour: 'quick', icon: 'activation_quick' },
  full: { colour: 'full', icon: 'activation_full' },
  reaction: { colour: 'reaction', icon: 'reaction' },
  protocol: { colour: 'protocol', icon: 'protocol' },
  free: { colour: 'free', icon: 'free_action' },
  overcharge: { colour: 'overcharge', icon: 'overcharge' },
  'quick tech': { colour: 'tech', icon: 'tech_quick' },
  'full tech': { colour: 'tech', icon: 'tech_full' },
  invade: { colour: 'tech', icon: 'tech_quick' },
}
export const activationOf = (value: unknown) => ACTIVATIONS[String(value ?? '').trim().toLowerCase()] ?? null

// An item's extra rules (ItemDetails.vue's actions, and the full-information dialog): on attack, hit and crit
// effects, actions with their trigger, and deployables with their stats and actions. Text stays formatted HTML for
// RulesText.vue. An action's activation (for its chip), frequency ("1/round") and own range and damage are separate.
const DEPLOYABLE_STATS = { size: 'Size', hp: 'HP', armor: 'Armour', evasion: 'Evasion', edef: 'E-defence', speed: 'Speed', heatcap: 'Heat cap' }
export type ItemRule = { name: string; text: string; activation?: string; frequency?: string; stats: ItemStat[] }
export function itemRules(raw: Record<string, unknown>, activeEffects = true): ItemRule[] {
  const result: ItemRule[] = []
  for (const key of ['on_attack', 'on_hit', 'on_crit']) if (raw[key]) result.push({ name: capitalise(key.replaceAll('_', ' ')), text: String(raw[key]), stats: [] })
  const entries = (value: unknown) => (Array.isArray(value) ? value : []) as Entry[]
  const extras = (entry: Record<string, unknown>) => ({
    ...(activationOf(entry.activation) ? { activation: String(entry.activation) } : {}),
    stats: [...entryStats('range', entries(entry.range)), ...entryStats('damage', entries(entry.damage))],
  })
  const action = (entry: Record<string, unknown>, fallback: string): ItemRule => {
    const trigger = entry.trigger ? `<b>Trigger:</b> ${String(entry.trigger)}<br>` : ''
    const text = `${trigger}${entry.trigger ? '<b>Effect:</b> ' : ''}${String(entry.detail ?? entry.description ?? '')}`
    return { name: String(entry.name ?? fallback), text, ...(entry.frequency ? { frequency: String(entry.frequency).toLowerCase() } : {}), ...extras(entry) }
  }
  for (const key of ['actions', 'deployables', ...(activeEffects ? ['active_effects'] : [])]) if (Array.isArray(raw[key])) for (const entry of raw[key] as Record<string, unknown>[]) {
    if (!entry || typeof entry !== 'object') continue
    const stats = Object.entries(DEPLOYABLE_STATS).filter(([stat]) => typeof entry[stat] === 'number').map(([stat, label]) => `${label} ${half(entry[stat] as number)}`).join(' · ')
    if (key === 'actions' && (entry.detail || entry.description)) result.push(action(entry, 'action'))
    else if (entry.detail || entry.description || stats) result.push({ name: String(entry.name ?? key), text: `${stats}${stats ? '. ' : ''}${entry.detail ?? entry.description ?? ''}`, ...extras(entry) })
    if (Array.isArray(entry.actions)) for (const inner of entry.actions as Record<string, unknown>[]) if (inner?.detail) result.push(action(inner, 'action'))
  }
  return result.map(rule => ({ ...rule, text: flatDamageText(rule.text) }))
}

// The rules an item card shows: COMP/CON's active effects mostly repeat the rules text, so they're left out, unless
// the item has no rules text and no other actions (then they're all it has).
export function cardRules(item: Item): ItemRule[] {
  const rules = itemRules(item.raw ?? {}, false)
  return rules.length || itemDetails(item, new Map()).text ? rules : itemRules(item.raw ?? {})
}
