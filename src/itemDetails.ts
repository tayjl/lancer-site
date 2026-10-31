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
import variableIcon from './assets/icons/variable.svg'
import { hiddenTags, type Item } from './gameData'
import { averageDamage, averageDamageText } from './damage'
import { plainText } from './rulesText'

// What an item card shows (ItemDetails.vue, and the pickers' one-line summaries): its stats with LANCER's
// symbols, its rules text and its tags.

// Armour bonuses: [label, icon].
const BONUSES: Record<string, [string, string | null]> = {
  pilot_armor: ['armour', armourIcon],
  pilot_hp: ['hp', hpIcon],
  pilot_edef: ['e-defense', eDefIcon],
  pilot_speed: ['speed', speedIcon],
}
// Weapon range and damage types, lower case.
const ICONS: Record<string, string> = {
  threat: threatIcon,
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
// Tags that only repeat what the slot already says.
const HIDDEN_TAGS = ['tg_gear', 'tg_pilot_weapon', 'tg_personal_armor']

// "tagNames" is lancer-data's tag list (e.g. "Limited {VAL}"); without it the id stands in ("limited").
export function itemDetails(item: Item, tagNames: Map<string, string>) {
  const stats = [
    ...item.bonuses.filter(bonus => bonus.id !== 'pilot_evasion').map((bonus) => {
      const [label, icon] = BONUSES[bonus.id] ?? [bonus.id.replace('pilot_', ''), null]
      return { label, icon, value: bonus.id === 'pilot_hp' && !bonus.replace ? `+${bonus.val}` : String(bonus.val) }
    }),
    ...item.range.map((entry) => ({
      label: entry.type.toLowerCase(),
      icon: ICONS[entry.type.toLowerCase()] ?? null,
      value: String(entry.val),
    })),
    ...item.damage.map(entry => ({
      label: entry.type.toLowerCase(),
      icon: ICONS[entry.type.toLowerCase()] ?? null,
      value: String(averageDamage(entry.val)),
    })),
    ...(item.sp ? [{ label: 'sp', icon: systemPointIcon, value: String(item.sp) }] : []),
  ]
  const tags = item.tags
    .filter((tag) => !HIDDEN_TAGS.includes(tag.id) && !hiddenTags.value.has(tag.id))
    .map((tag) => {
      const name = tagNames.get(tag.id) ?? tag.id.replace(/^tg_/, '').replaceAll('_', ' ')
      return (name.includes('{VAL}') ? name.replace('{VAL}', String(tag.val ?? '')) : `${name}${tag.val != null ? ` ${tag.val}` : ''}`)
        .trim()
        .toLowerCase()
    })
  // Pilot gear often has no rules text, only flavour, so it falls back to the description.
  // Still formatted HTML: RulesText.vue draws it safely, plainText() flattens it for pickers.
  const text = averageDamageText(plainText(item.effect) ? item.effect : item.type === 'Gear' ? item.description : '')
  return { stats, tags, text }
}

// One line for a picker: "range 10, kinetic 4, sp 1".
export const statLine = (details: ReturnType<typeof itemDetails>) =>
  details.stats.map((stat) => `${stat.label} ${stat.value}`).join(', ')

// An item's extra rules (ItemDetails.vue's "modifiers and rules", and the full-information dialog): on attack,
// hit and crit effects, actions with their activation and trigger, and deployables with their stats and actions.
// Text stays formatted HTML for RulesText.vue.
export function itemRules(raw: Record<string, unknown>) {
  const result: { name: string; text: string }[] = []
  for (const key of ['on_attack', 'on_hit', 'on_crit']) if (raw[key]) result.push({ name: key.replaceAll('_', ' '), text: String(raw[key]) })
  const action = (entry: Record<string, unknown>, fallback: string) => {
    const when = [entry.activation, entry.frequency].filter(Boolean).join(', ').toLowerCase()
    const name = `${String(entry.name ?? fallback)}${when ? ` (${when})` : ''}`
    const trigger = entry.trigger ? `<b>Trigger:</b> ${String(entry.trigger)}<br>` : ''
    return { name, text: `${trigger}${entry.trigger ? '<b>Effect:</b> ' : ''}${String(entry.detail ?? entry.description ?? '')}` }
  }
  for (const key of ['actions', 'deployables', 'active_effects']) if (Array.isArray(raw[key])) for (const entry of raw[key] as Record<string, unknown>[]) {
    if (!entry || typeof entry !== 'object') continue
    const stats = ['size', 'hp', 'armor', 'evasion', 'edef', 'speed', 'heatcap'].filter(stat => typeof entry[stat] === 'number').map(stat => `${stat} ${entry[stat] === 0.5 ? '½' : entry[stat]}`).join(' · ')
    if (key === 'actions' && (entry.detail || entry.description)) result.push(action(entry, 'action'))
    else if (entry.detail || entry.description || stats) result.push({ name: String(entry.name ?? key), text: `${stats}${stats ? '. ' : ''}${entry.detail ?? entry.description ?? ''}` })
    if (Array.isArray(entry.actions)) for (const inner of entry.actions as Record<string, unknown>[]) if (inner?.detail) result.push(action(inner, 'action'))
  }
  return result.map(rule => ({ ...rule, text: averageDamageText(rule.text) }))
}
