import { shallowRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { ArchiveCategory } from './archive'
import { flatDamageText } from './damage'
import { hiddenTags, STAT_ICONS, tagDescriptions, tagNames, type Bionic, type CoreBonus, type Item, type Talent } from './gameData'
import { activationOf, itemDetails, itemRules } from './itemDetails'
import { alternateOf, licenceFrames, licenceNames, mechStats, sameName, type Frame } from './mechData'
import { PRICES, rankName } from './rules'
import { capitalise, plural } from './text'

// Everything about one thing a pilot can buy or equip, for the full-information dialog (InfoDialog.vue, opened by
// InfoButton.vue from cards, licence ranks and pickers). Every kind has the same layout, from the developer's frame
// sketch: the name with its lore under it, then its stats, then groups of rule cards (a frame's traits, its core
// power with the power's own lore, an item's rules, its tags). Rules text stays formatted HTML for RulesText.vue.
// An action's card also has its activation (ActionChip.vue), frequency and own range and damage (itemRules).
// "actions": a frame trait's other actions, each drawn inside the trait's card with its own chip.
// "unlocks": the gear a licence rank unlocks (UnlockList.vue).
export type InfoCard = { heading: string; html: string; activation?: string; frequency?: string; stats?: InfoStat[]; actions?: InfoCard[]; unlocks?: Unlock[] }
// "stack": cards one above another, for rules read in order (an item's effect, then on attack, on hit...).
// "tags": tag chips, each with what it means. "look" draws a frame's groups as item cards (ItemCard.vue): "traits"
// a card per trait in the frame colour, "core" the whole group as one card in the core colour, titled by the group.
export type InfoGroup = { title?: string; lore?: string; stack?: boolean; tags?: boolean; look?: 'traits' | 'core'; cards: InfoCard[] }
// Facts under the name.
export type InfoFact = { text: string }
// "range": where the value sits among every frame's (the radar chart).
// "kind" is an item stat's (itemDetails): range, damage, bonus or sp.
export type InfoStat = { label: string; value: string; icon?: string | null; kind?: string; range?: { min: number; max: number; at: number } }
// "source": the manufacturer's id, if it has one, so the dialog takes that manufacturer's colour.
// "id": the thing's own id in the packs, for the "Source:" line (not for bionics, which aren't pack content).
export type Info = { kind: string; id?: string; name: string; source?: string; facts: InfoFact[]; lore?: string; stats: InfoStat[]; groups: InfoGroup[] }

// The one dialog's contents; null while it's closed.
export const shownInfo = shallowRef<Info | null>(null)
export const showInfo = (info: Info) => { shownInfo.value = info }

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const list = (value: unknown) => (Array.isArray(value) ? value : [])
const facts = (...all: (InfoFact | string)[]): InfoFact[] =>
  all.map((fact) => (typeof fact === 'string' ? { text: fact } : fact)).filter((fact) => fact.text)
const card = (heading: string, html: unknown): InfoCard[] => (text(html) ? [{ heading, html: flatDamageText(text(html)) }] : [])
// On attack / hit / crit effects, actions and deployables (itemRules), as cards.
const rules = (raw: Record<string, unknown>): InfoCard[] =>
  itemRules(raw).map(({ name, text, ...action }) => ({ heading: name, html: text, ...action }))
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
    card: twin ? { ...twin, heading: parent.heading } : parent,
    rest: actions.filter((action) => !twins.includes(action)),
  }
}
const half = (value: number | null) => (value === 0.5 ? '½' : String(value ?? '-'))

function tagCards(tags: Item['tags']): InfoCard[] {
  return tags
    .filter((tag) => !hiddenTags.value.has(tag.id))
    .map((tag) => {
      const fill = (value: string) => value.replaceAll('{VAL}', String(tag.val ?? 'X'))
      return { heading: fill(tagNames.value.get(tag.id) ?? tag.id.replace(/^tg_/, '').replaceAll('_', ' ')).toLowerCase(), html: fill(tagDescriptions.value.get(tag.id) ?? '') }
    })
}

const PILOT_KINDS: Record<string, string> = { Armor: 'Pilot armour', Weapon: 'Pilot weapon', Gear: 'Pilot gear' }

// A mech weapon or system, or pilot gear.
export function itemInfo(item: Item): Info {
  const raw = item.raw ?? {}
  const pilot = PILOT_KINDS[item.type] && !item.mount
  const effect = text(item.effect)
  return {
    kind: pilot ? PILOT_KINDS[item.type] : item.type === 'Mod' ? 'Weapon mod' : capitalise((item.mount ? `${item.mount} ${item.type} weapon` : item.type || 'system').toLowerCase()),
    id: item.id,
    name: item.name,
    source: text(raw.source),
    facts: facts(
      text(raw.source),
      pilot ? '' : { text: item.licenceLevel > 0 ? `Licence: ${licenceNames.value.get(item.licenceId) ?? item.licenceId} ${rankName(item.licenceLevel)}` : 'No licence needed' },
    ),
    // Pilot gear often has only a description, which then is its rules rather than lore.
    lore: effect ? merged(text(item.description)) : '',
    stats: itemDetails(item, tagNames.value).stats,
    groups: groups(
      { title: 'Rules', stack: true, cards: [...(effect ? card('Effect', effect) : card('Description', merged(text(item.description)))), ...rules(raw)] },
      { title: 'Tags', tags: true, cards: tagCards(item.tags) },
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
    id: frame.id,
    name: frame.name,
    source: frame.source,
    facts: facts(
      { text: frame.mechtype.join(' / ') },
      `Mounts: ${frame.mounts.join(', ')}`,
      { text: frame.licenceLevel ? `Licence: ${(alternateOf(frame, frames) ?? frame).name} ${rankName(frame.licenceLevel)}` : 'No licence needed' },
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
        const name = text(trait.name) || 'Trait'
        const { card: main, rest } = absorb({ heading: name, html: flatDamageText(text(trait.description)) }, name, rules(trait))
        return main.html || rest.length ? [{ ...main, ...(rest.length ? { actions: rest } : {}) }] : []
      }) },
      {
        title: text(core.name) || 'Core system',
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
  const passive = fold({ heading: `Passive${text(core.passive_name) ? `: ${text(core.passive_name)}` : ''}`, html: flatDamageText(text(core.passive_effect)) }, text(core.passive_name))
  const powerName = text(core.active_name) || text(core.name)
  const power = text(core.active_effect)
    ? [fold({ heading: powerName, html: flatDamageText(text(core.active_effect)), ...(activationOf(core.activation) ? { activation: text(core.activation) } : {}) }, powerName)]
    : []
  return [passive, ...power, ...actions].filter((entry) => entry.html)
}

export function talentInfo(talent: Talent): Info {
  return {
    kind: 'Talent',
    id: talent.id,
    name: talent.name,
    facts: [],
    lore: text(talent.terse),
    stats: [],
    groups: groups({ title: 'Ranks', cards: talent.ranks.flatMap((rank, index) => card(`Rank ${rankName(index + 1)}: ${rank.name}`, rank.description)) }),
  }
}

export function coreBonusInfo(bonus: CoreBonus): Info {
  return {
    kind: `${bonus.source} core bonus`.trim(),
    id: bonus.id,
    name: bonus.name,
    source: bonus.source,
    facts: [],
    lore: paragraphs(text(bonus.description)),
    stats: [],
    groups: groups({ title: 'Rules', stack: true, cards: [...card('Effect', bonus.effect), ...card('Mounted effect', bonus.mounted_effect)] }),
  }
}

// Bionics are campaign content (plain text descriptions); "statNames" turns stat ids into their names.
// "1 mod point", "2 mod points": the one wording for a biomod's mod-point cost (info, archives, picker).
export const modPoints = (n: number) => plural(n, 'mod point')

export function bionicInfo(bionic: Bionic, statNames: Map<string, string>): Info {
  return {
    kind: 'Biomod',
    id: String(bionic.id), // so the archives can tell whether the dialog already shows it
    name: bionic.name,
    source: bionic.source ?? undefined,
    facts: facts(bionic.source ?? '', bionic.slot, modPoints(bionic.mod_point_cost), `${bionic.manna_cost} manna`, bionic.retired ? 'Retired' : ''),
    stats: bionic.bonuses.map((bonus) => ({ label: statNames.get(bonus.stat_id) ?? bonus.stat_id, icon: STAT_ICONS[bonus.stat_id], value: `${bonus.amount > 0 ? '+' : ''}${bonus.amount}` })),
    // The description is flavour, drawn as lore like a frame's; it's plain text, so escaped.
    lore: text(bionic.description) ? `<p>${text(bionic.description).replace(/[&<]/g, (c) => (c === '&' ? '&amp;' : '&lt;'))}</p>` : '',
    groups: groups({ title: 'Rules', cards: card('Effect', bionic.effect) }),
  }
}

// A manufacturer (from the packs' manufacturers): its motto and history, and the frames it makes.
// "colour" is the manufacturer's accent for dark backgrounds (the packs' "dark" colour); "logo" names its logo
// (e.g. "ips-n", see makerLogo() in archive.ts).
export type Manufacturer = { id: string; name: string; quote: string; description: string; colour?: string; logo?: string }
export function manufacturerInfo(manufacturer: Manufacturer, frames: Frame[] = []): Info {
  const made = frames.filter((frame) => frame.source === manufacturer.id)
  return {
    kind: 'Manufacturer',
    id: manufacturer.id,
    name: manufacturer.name,
    source: manufacturer.id,
    facts: facts(manufacturer.id !== manufacturer.name ? manufacturer.id : '', made.length ? plural(made.length, 'frame') : ''),
    lore: [text(manufacturer.quote) ? `<p>${text(manufacturer.quote)}</p>` : '', paragraphs(text(manufacturer.description))].join(''),
    stats: [],
    groups: groups({ title: 'Frames', cards: made.flatMap((frame) => card(frame.name, frame.mechtype.join(' / ') || 'Frame')) }),
  }
}

// A link to one entry in the archives (the url ArchivesView.vue reads: ?cat= and ?item=). Only for things the archives
// list: frames, and the weapons, systems and mods a pilot can pick (not built-in or talent-only equipment).
export const archiveLink = (category: ArchiveCategory, id: string): RouteLocationRaw => ({ name: 'archives', query: { cat: category, item: `${category}:${id}` } })
// "to" links to its archive entry (the licence's information); "info" opens its full information (the sheet's ladder and
// the editor, which shouldn't navigate away).
export type Unlock = { kind: 'frame' | 'weapon' | 'system' | 'mod'; name: string; to: RouteLocationRaw; info: () => Info }

// What rank "level" (1 to 3) of a frame's licence unlocks: the frame and its alternate frames (each at its own level),
// weapons, systems and mods.
export const licenceUnlocks = (frame: Frame, weapons: Item[], systems: Item[], mods: Item[], level: number, frames: Frame[] = [frame]): Unlock[] => [
  ...licenceFrames(frame, frames).filter((f) => f.licenceLevel === level).map((f) => ({ kind: 'frame' as const, name: f.name, to: archiveLink('frames', f.id), info: () => frameInfo(f, frames) })),
  ...weapons.filter((item) => item.licenceId === frame.id && item.licenceLevel === level).map((item) => ({ kind: 'weapon' as const, name: item.name, to: archiveLink('mech weapons', item.id), info: () => itemInfo(item) })),
  ...systems.filter((item) => item.licenceId === frame.id && item.licenceLevel === level).map((item) => ({ kind: 'system' as const, name: item.name, to: archiveLink('mech systems', item.id), info: () => itemInfo(item) })),
  ...mods.filter((item) => item.licenceId === frame.id && item.licenceLevel === level).map((item) => ({ kind: 'mod' as const, name: item.name, to: archiveLink('weapon mods', item.id), info: () => itemInfo(item) })),
]

// A licence (one per licensed frame): what each of its three ranks unlocks, side by side like the sheet's ladder.
export function licenceInfo(frame: Frame, weapons: Item[] = [], systems: Item[] = [], mods: Item[] = [], frames: Frame[] = [frame]): Info {
  return {
    kind: `${frame.source} licence`.trim(),
    id: frame.id,
    name: frame.name,
    source: frame.source,
    facts: facts({ text: frame.mechtype.join(' / ') }, `${PRICES.licenceRank} manna per rank`),
    lore: '',
    stats: [],
    groups: groups({ title: 'Ranks', cards: [1, 2, 3].map((level) => {
      const unlocks = licenceUnlocks(frame, weapons, systems, mods, level, frames)
      return { heading: `Rank ${rankName(level)}`, html: unlocks.length ? '' : 'No unlocks.', unlocks }
    }) }),
  }
}
