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
import type { Item } from './gameData'
import { averageDamage, averageDamageText } from './damage'

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

// Rules text without its HTML (it's shown as plain text, never as HTML).
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

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
      label: `${entry.type.toLowerCase()} (average)`,
      icon: ICONS[entry.type.toLowerCase()] ?? null,
      value: String(averageDamage(entry.val)),
    })),
    ...(item.sp ? [{ label: 'sp', icon: systemPointIcon, value: String(item.sp) }] : []),
  ]
  const tags = item.tags
    .filter((tag) => !HIDDEN_TAGS.includes(tag.id))
    .map((tag) => {
      const name = tagNames.get(tag.id) ?? tag.id.replace(/^tg_/, '').replaceAll('_', ' ')
      return (name.includes('{VAL}') ? name.replace('{VAL}', String(tag.val ?? '')) : `${name}${tag.val != null ? ` ${tag.val}` : ''}`)
        .trim()
        .toLowerCase()
    })
  // Pilot gear often has no rules text, only flavour, so it falls back to the description.
  const text = averageDamageText(plain(item.effect) || (item.type === 'Gear' ? plain(item.description) : ''))
  return { stats, tags, text }
}

// One line for a picker: "range 10, kinetic (average) 4, sp 1".
export const statLine = (details: ReturnType<typeof itemDetails>) =>
  details.stats.map((stat) => `${stat.label} ${stat.value}`).join(', ')
