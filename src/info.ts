import { shallowRef } from 'vue'
import { averageDamageText } from './damage'
import { hiddenTags, STAT_ICONS, tagDescriptions, tagNames, type Bionic, type CoreBonus, type Item, type Talent } from './gameData'
import { activationOf, itemDetails, itemRules } from './itemDetails'
import { licenceNames, mechStats, sameName, type Frame } from './mechData'
import { PRICES, rankName } from './rules'

// Everything about one thing a pilot can buy or equip, for the full-information dialog (InfoDialog.vue, opened by
// InfoButton.vue from cards, licence ranks and pickers). Every kind has the same layout, from the developer's frame
// sketch: the name with its lore under it, then its stats, then groups of rule cards (a frame's traits, its core
// power with the power's own lore, an item's rules, its tags). Rules text stays formatted HTML for RulesText.vue.
// Each card and group title has a "tone", one of the site's accents, by what it is (TONES), for colour and contrast.
export type Tone = 'lilac' | 'rose' | 'sky'
// An action's card also has its activation (ActionChip.vue), frequency and own range and damage (itemRules).
// "actions": a frame trait's other actions, each drawn inside the trait's card with its own chip.
export type InfoCard = { heading: string; html: string; tone: Tone; activation?: string; frequency?: string; stats?: InfoStat[]; actions?: InfoCard[] }
// "stack": cards one above another, for rules read in order (an item's effect, then on attack, on hit...).
// "tags": tag chips, each with what it means. "look" draws a frame's groups as item cards (ItemCard.vue): "traits"
// a card per trait in the frame colour, "core" the whole group as one card in the core colour, titled by the group.
export type InfoGroup = { title?: string; tone?: Tone; lore?: string; stack?: boolean; tags?: boolean; look?: 'traits' | 'core'; cards: InfoCard[] }
// Facts under the name; "tone" colours the important ones (a frame's classification, the licence).
export type InfoFact = { text: string; tone?: Tone }
// "range": where the value sits among every frame's (the radar chart).
// "kind" is an item stat's (itemDetails): range, damage, bonus or sp.
export type InfoStat = { label: string; value: string; icon?: string | null; kind?: string; range?: { min: number; max: number; at: number } }
// "source": the manufacturer's id, if it has one, so the dialog takes that manufacturer's colour.
export type Info = { kind: string; name: string; source?: string; facts: InfoFact[]; lore?: string; stats: InfoStat[]; groups: InfoGroup[] }

// The one dialog's contents; null while it's closed.
export const shownInfo = shallowRef<Info | null>(null)
export const showInfo = (info: Info) => { shownInfo.value = info }

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const list = (value: unknown) => (Array.isArray(value) ? value : [])
// What each colour means here (the developer's rule, 2026-10-31): lilac for descriptions, stats and general rules;
// sky for tags, frame traits and licences; rose for combat: on attack / hit / crit, actions, summons (drones,
// grenades, mines, deployables), core powers, and a frame's classification.
const TONES = { rules: 'lilac', trait: 'sky', tag: 'sky', licence: 'sky', combat: 'rose', power: 'rose', classification: 'rose' } as const
// Things that summon or throw something (drones, grenades, mines, deployables): their effect is combat, so rose.
const SUMMON_TYPES = ['Deployable', 'Drone']
const SUMMON_TAGS = ['tg_grenade', 'tg_mine', 'tg_drone', 'tg_deployable']
const summons = (item: Item) =>
  SUMMON_TYPES.includes(item.type) || item.tags.some((tag) => SUMMON_TAGS.includes(tag.id)) || list(item.raw?.deployables).length > 0
const facts = (...all: (InfoFact | string)[]): InfoFact[] =>
  all.map((fact) => (typeof fact === 'string' ? { text: fact } : fact)).filter((fact) => fact.text)
const card = (heading: string, html: unknown, tone: Tone = TONES.rules): InfoCard[] => (text(html) ? [{ heading, html: averageDamageText(text(html)), tone }] : [])
// On attack / hit / crit effects, actions and deployables (itemRules), as combat cards.
const rules = (raw: Record<string, unknown>): InfoCard[] =>
  itemRules(raw).map(({ name, text, ...action }) => ({ heading: name, html: text, tone: TONES.combat, ...action }))
// Groups with nothing in them are left out.
const groups = (...all: InfoGroup[]) => all.filter((group) => group.cards.length)
// Lore separates its paragraphs with single line breaks; as real paragraphs they get space between them.
const paragraphs = (html: string) => html.split(/<br\s*\/?>/i).map((part) => part.trim()).filter(Boolean).map((part) => `<p>${part}</p>`).join('')
// Item descriptions are short: their paragraphs read better run together.
const merged = (html: string) => html.replace(/\s*<br\s*\/?>\s*/gi, ' ')
// An action named like the trait or core power it belongs to repeats it (COMP/CON's data often has both): show it
// once, under the parent's heading, with the action's chip, numbers and text (the more detailed version); every
// same-named action goes. Differently named actions stay, in "rest".
function absorb(parent: InfoCard, name: string, actions: InfoCard[]) {
  const twins = actions.filter((action) => sameName(action.heading, name))
  const twin = twins.find((action) => action.activation || action.stats?.length) ?? twins.sort((a, b) => b.html.length - a.html.length)[0]
  return {
    card: twin ? { ...twin, heading: parent.heading, tone: parent.tone } : parent,
    rest: actions.filter((action) => !twins.includes(action)),
  }
}
const half = (value: number | null) => (value === 0.5 ? '½' : String(value ?? '-'))

function tagCards(tags: Item['tags']): InfoCard[] {
  return tags
    .filter((tag) => !hiddenTags.value.has(tag.id))
    .map((tag) => {
      const fill = (value: string) => value.replaceAll('{VAL}', String(tag.val ?? 'X'))
      return { heading: fill(tagNames.value.get(tag.id) ?? tag.id.replace(/^tg_/, '').replaceAll('_', ' ')).toLowerCase(), html: fill(tagDescriptions.value.get(tag.id) ?? ''), tone: TONES.tag }
    })
}

const PILOT_KINDS: Record<string, string> = { Armor: 'pilot armour', Weapon: 'pilot weapon', Gear: 'pilot gear' }

// A mech weapon or system, or pilot gear.
export function itemInfo(item: Item): Info {
  const raw = item.raw ?? {}
  const pilot = PILOT_KINDS[item.type] && !item.mount
  const effect = text(item.effect)
  return {
    kind: pilot ? PILOT_KINDS[item.type] : item.mount ? `${item.mount} ${item.type} weapon`.toLowerCase() : (item.type || 'system').toLowerCase(),
    name: item.name,
    source: text(raw.source),
    facts: facts(
      text(raw.source),
      pilot ? '' : { text: item.licenceLevel > 0 ? `licence: ${licenceNames.value.get(item.licenceId) ?? item.licenceId} ${rankName(item.licenceLevel)}` : 'no licence needed', tone: TONES.licence },
    ),
    // Pilot gear often has only a description, which then is its rules rather than lore.
    lore: effect ? merged(text(item.description)) : '',
    stats: itemDetails(item, tagNames.value).stats,
    groups: groups(
      { title: 'rules', stack: true, cards: [...(effect ? card('effect', effect, summons(item) ? TONES.combat : TONES.rules) : card('description', merged(text(item.description)))), ...rules(raw)] },
      { title: 'tags', tone: TONES.tag, tags: true, cards: tagCards(item.tags) },
    ),
  }
}

// "frames" (every frame) places each stat on the radar between the lowest and the highest any frame has.
export function frameInfo(frame: Frame, frames: Frame[] = []): Info {
  const raw = frame.raw ?? {}
  const core = (raw.core_system ?? {}) as Record<string, unknown>
  const traits = list(raw.traits) as Record<string, unknown>[]
  const others = frames.map((other) => mechStats(other, undefined, []))
  return {
    kind: `${frame.source} frame`.trim(),
    name: frame.name,
    source: frame.source,
    facts: facts(
      { text: frame.mechtype.join(' / ').toLowerCase(), tone: TONES.classification },
      `mounts: ${frame.mounts.join(', ').toLowerCase()}`,
      { text: frame.licenceLevel ? `licence: ${frame.name} ${rankName(frame.licenceLevel)}` : 'no licence needed', tone: TONES.licence },
    ),
    lore: paragraphs(text(frame.description)),
    // The frame's own numbers, before HASE and bonuses.
    stats: mechStats(frame, undefined, []).map((stat, i) => {
      const values = others.map((stats) => stats[i].value).filter((value): value is number => typeof value === 'number')
      return {
        label: stat.name,
        value: half(stat.value),
        icon: stat.icon,
        range: values.length && stat.value !== null ? { min: Math.min(...values), max: Math.max(...values), at: stat.value } : undefined,
      }
    }),
    groups: groups(
      // One card per trait, its other actions (e.g. a reaction) inside it. Untitled: the cards say what they are.
      { look: 'traits', cards: traits.flatMap((trait) => {
        const name = text(trait.name) || 'trait'
        const { card: main, rest } = absorb({ heading: name, html: averageDamageText(text(trait.description)), tone: TONES.trait }, name, rules(trait))
        return main.html || rest.length ? [{ ...main, ...(rest.length ? { actions: rest } : {}) }] : []
      }) },
      {
        title: text(core.name) || 'core system',
        tone: TONES.power,
        look: 'core',
        lore: paragraphs(text(core.description)),
        cards: coreCards(core),
      },
    ),
  }
}

// A core system's passive and its power (no "core power:" label: its place under the core system says so), each
// with a same-named action folded in, then its other actions and deployables.
function coreCards(core: Record<string, unknown>): InfoCard[] {
  let actions = rules({ actions: [...list(core.passive_actions), ...list(core.active_actions)], deployables: core.deployables })
  const fold = (parent: InfoCard, name: string) => {
    if (!name) return parent
    const { card, rest } = absorb(parent, name, actions)
    actions = rest
    return card
  }
  const passive = fold({ heading: `passive${text(core.passive_name) ? `: ${text(core.passive_name)}` : ''}`, html: averageDamageText(text(core.passive_effect)), tone: TONES.rules }, text(core.passive_name))
  const powerName = text(core.active_name) || text(core.name)
  const power = text(core.active_effect)
    ? [fold({ heading: powerName, html: averageDamageText(text(core.active_effect)), tone: TONES.power, ...(activationOf(core.activation) ? { activation: text(core.activation) } : {}) }, powerName)]
    : []
  return [passive, ...power, ...actions].filter((entry) => entry.html)
}

export function talentInfo(talent: Talent): Info {
  return {
    kind: 'talent',
    name: talent.name,
    facts: [],
    lore: text(talent.terse),
    stats: [],
    groups: groups({ title: 'ranks', cards: talent.ranks.flatMap((rank, index) => card(`rank ${rankName(index + 1)}: ${rank.name}`, rank.description)) }),
  }
}

export function coreBonusInfo(bonus: CoreBonus): Info {
  return {
    kind: `${bonus.source} core bonus`.trim(),
    name: bonus.name,
    source: bonus.source,
    facts: [],
    lore: paragraphs(text(bonus.description)),
    stats: [],
    groups: groups({ title: 'rules', stack: true, cards: [...card('effect', bonus.effect), ...card('mounted effect', bonus.mounted_effect)] }),
  }
}

// Bionics are campaign content (plain text descriptions); "statNames" turns stat ids into their names.
export function bionicInfo(bionic: Bionic, statNames: Map<string, string>, price: number): Info {
  return {
    kind: 'bionic',
    name: bionic.name,
    facts: facts(`${bionic.mod_point_cost} mod points`, `${price} manna`, bionic.retired ? 'retired: no longer offered' : ''),
    stats: bionic.bonuses.map((bonus) => ({ label: statNames.get(bonus.stat_id) ?? bonus.stat_id, icon: STAT_ICONS[bonus.stat_id], value: `${bonus.amount > 0 ? '+' : ''}${bonus.amount}` })),
    groups: groups({ title: 'rules', cards: card('description', (bionic.description ?? '').replace(/[&<]/g, (c) => (c === '&' ? '&amp;' : '&lt;'))) }),
  }
}

// A manufacturer (from the packs' manufacturers): its motto and history, and the frames it makes.
// "colour" is the manufacturer's accent for dark backgrounds (the packs' "dark" colour); "logo" names its logo
// (e.g. "ips-n", see makerLogo() in archive.ts).
export type Manufacturer = { id: string; name: string; quote: string; description: string; colour?: string; logo?: string }
export function manufacturerInfo(manufacturer: Manufacturer, frames: Frame[] = []): Info {
  const made = frames.filter((frame) => frame.source === manufacturer.id)
  return {
    kind: 'manufacturer',
    name: manufacturer.name,
    source: manufacturer.id,
    facts: facts(manufacturer.id !== manufacturer.name ? manufacturer.id : '', made.length ? `${made.length} frames` : ''),
    lore: [text(manufacturer.quote) ? `<p>${text(manufacturer.quote)}</p>` : '', paragraphs(text(manufacturer.description))].join(''),
    stats: [],
    groups: groups({ title: 'frames', cards: made.flatMap((frame) => card(frame.name, frame.mechtype.join(' / ').toLowerCase() || 'frame')) }),
  }
}

// What rank "level" (1 to 3) of a frame's licence unlocks: the frame itself (at its own level), weapons and systems.
export const licenceUnlocks = (frame: Frame, weapons: Item[], systems: Item[], level: number) => [
  ...(frame.licenceLevel === level ? [{ kind: 'frame', name: frame.name }] : []),
  ...weapons.filter((item) => item.licenceId === frame.id && item.licenceLevel === level).map((item) => ({ kind: 'weapon', name: item.name })),
  ...systems.filter((item) => item.licenceId === frame.id && item.licenceLevel === level).map((item) => ({ kind: 'system', name: item.name })),
]

// A licence (one per licensed frame): what each of its three ranks unlocks, side by side like the sheet's ladder.
export function licenceInfo(frame: Frame, weapons: Item[] = [], systems: Item[] = []): Info {
  const unlocks = (level: number) => licenceUnlocks(frame, weapons, systems, level).map((unlock) => `<li><b>${unlock.kind}:</b> ${unlock.name}</li>`)
  return {
    kind: `${frame.source} licence`.trim(),
    name: frame.name,
    source: frame.source,
    facts: facts({ text: frame.mechtype.join(' / ').toLowerCase(), tone: TONES.classification }, `${PRICES.licenceRank} manna per rank`),
    lore: '',
    stats: [],
    groups: groups({ title: 'ranks', cards: [1, 2, 3].flatMap((level) => {
      const items = unlocks(level)
      return card(`rank ${rankName(level)}`, items.length ? `<ul>${items.join('')}</ul>` : 'nothing new at this rank.')
    }) }),
  }
}
