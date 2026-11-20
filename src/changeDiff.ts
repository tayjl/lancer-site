import type { Json } from './lib/database.types'
import type { MechPrivate, Sheet } from './myPilot'
import type { PublicMech } from './pilots'
import { docText } from './richTextSafe'
import { PRICES, rankName } from './rules'
import { capitalise } from './text'

// What a pending change changes, in plain words, for the GM review (/gm/changes/:id): the approved pilot
// ("before") against the proposed one ("after"). Item ids are turned into names with "names".

// The public columns a pending change can hold (approve_change copies exactly these).
export const PUBLIC_COLUMNS = [
  'pilot_name',
  'callsign',
  'age',
  'gender',
  'sexuality',
  'height',
  'weight',
  'eye_colour',
  'hair_colour',
  'appearance',
  'pilot_image',
  'personality',
  'traits',
  'mechs',
] as const
export type PublicCard = Partial<Record<(typeof PUBLIC_COLUMNS)[number], Json | null>>

export type Names = {
  stat: (id: string) => string
  licence: (id: string) => string
  talent: (id: string) => string
  coreBonus: (id: string) => string
  bionic: (id: number) => string
  gear: (id: string) => string
  frame: (id: string) => string
  weapon: (id: string) => string
  system: (id: string) => string
  mod: (id: string) => string
}

// Each line says what happened to one thing: added (new), raised or lowered (a number or rank went up or down),
// removed (gone) or updated (anything else). The text names the thing without repeating the verb: "Acuity 2 → 3".
export type DiffLine = {
  section: string
  text: string
  kind: 'added' | 'raised' | 'removed' | 'lowered' | 'updated'
  doc?: Json | null // new writing, for the lines about long text
  before?: Json | null // the writing it replaces, when there was some
  manna?: number // what this line costs (positive) or refunds (negative); left out when it's free
  mechId?: string // the mech a "mech: ..." line belongs to
}

// What a biomod or a pilot gear item costs, by id, so its line can show the manna.
export type Prices = { bionic: (id: number) => number; gear?: (id: string) => number }

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const shown = (value: unknown) => (value === null || value === undefined || value === '' ? '-' : String(value))

// Items added and removed between two lists, counting repeats (two of the same drone are two items).
export function listDiff<T>(before: T[] = [], after: T[] = []) {
  const left = [...before]
  const added: T[] = []
  for (const item of after) {
    const i = left.indexOf(item)
    if (i >= 0) left.splice(i, 1)
    else added.push(item)
  }
  return { added, removed: left }
}

export function changeDiff(
  before: { card: PublicCard; sheet: Sheet },
  after: { card: PublicCard; sheet: Sheet },
  names: Names,
  prices?: Prices,
): DiffLine[] {
  const lines: DiffLine[] = []
  let mechId: string | undefined // the mech whose lines are being added, so they stay with it whatever its name
  // Sentence case: the first letter is a capital, whatever the name or id starts with.
  const add = (section: string, text: string, kind: DiffLine['kind'] = 'updated', doc?: Json | null, extra: Pick<DiffLine, 'before' | 'manna'> = {}) =>
    lines.push({
      section, text: text.charAt(0).toUpperCase() + text.slice(1), kind, ...(mechId ? { mechId } : {}), ...(doc !== undefined ? { doc } : {}),
      ...(extra.before ? { before: extra.before } : {}), ...(extra.manna ? { manna: extra.manna } : {}),
    })
  const listChanges = <T>(section: string, from: T[] | undefined, to: T[] | undefined, name: (item: T) => string, price?: (item: T) => number) => {
    const { added, removed } = listDiff(from, to)
    added.forEach((item) => add(section, name(item), 'added', undefined, { manna: price?.(item) }))
    removed.forEach((item) => add(section, name(item), 'removed', undefined, { manna: price ? -price(item) : undefined }))
  }
  // Before → after for a field: added when it was empty, removed when it's emptied, otherwise updated.
  const field = (section: string, label: string, a: unknown, b: unknown) =>
    add(section, `${label}: ${shown(a)} → ${shown(b)}`, shown(a) === '-' ? 'added' : shown(b) === '-' ? 'removed' : 'updated')
  const ranks = (section: string, from: Record<string, number> = {}, to: Record<string, number> = {}, name: (id: string) => string, unit: number) => {
    for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const [a, b] = [from[id] ?? 0, to[id] ?? 0]
      if (a === b) continue
      const extra = { manna: (b - a) * unit }
      if (a === 0) add(section, `${name(id)}, rank ${rankName(b)}`, 'added', undefined, extra)
      else if (b === 0) add(section, `${name(id)}, rank ${rankName(a)}`, 'removed', undefined, extra)
      else add(section, `${name(id)}, rank ${rankName(a)} → ${rankName(b)}`, b > a ? 'raised' : 'lowered', undefined, extra)
    }
  }
  const stats = (section: string, from: Record<string, number> = {}, to: Record<string, number> = {}, start: number) => {
    for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const [a, b] = [from[id] ?? start, to[id] ?? start]
      if (a !== b) add(section, `${names.stat(id)} ${a} → ${b}`, b > a ? 'raised' : 'lowered')
    }
  }
  // Item descriptions ([item id, description, own key] in list order), compared by item (its own key, or its id and which copy)
  // rather than by place, so items closing up after a removal don't read as changed text: "Assault Rifle description: - → salvaged railgun".
  type Described = [string | null, string | undefined, string?]
  const descriptions = (section: string, from: Described[], to: Described[], name: (id: string) => string) => {
    const byItem = (entries: Described[]) => {
      const copies = new Map<string, number>()
      const result = new Map<string, [string, string]>()
      for (const [id, text, own] of entries) {
        if (!id) continue
        copies.set(id, (copies.get(id) ?? 0) + 1)
        if (text) result.set(own ?? `${id}#${copies.get(id)}`, [id, text])
      }
      return result
    }
    const [a, b] = [byItem(from), byItem(to)]
    for (const key of new Set([...a.keys(), ...b.keys()]))
      if (a.get(key)?.[1] !== b.get(key)?.[1]) field(section, `${name((a.get(key) ?? b.get(key))![0])} description`, a.get(key)?.[1], b.get(key)?.[1])
  }
  // Pilot gear is owned by key. A new pilot (nothing owned before) just has its loadout; an approved pilot's new keys are bought.
  const owned = (sheet: Sheet) => sheet.owned_gear ?? []
  const gearNotes = (sheet: Sheet) => owned(sheet).map((item): Described => [item.id, item.notes, item.key])
  const bought = (before.sheet.owned_gear ? owned(after.sheet).filter(item => !owned(before.sheet).some(was => was.key === item.key)) : [])
  const systemNotes = (m: MechPrivate) => (m.systems ?? []).map((id, index): [string, string | undefined] => [id, m.system_notes?.[index]])

  // Public card.
  for (const column of ['pilot_name', 'callsign', 'age', 'gender', 'sexuality', 'height', 'weight', 'eye_colour', 'hair_colour'] as const)
    if (!same(before.card[column], after.card[column])) field('identity', capitalise(column.replace('_', ' ')), before.card[column], after.card[column])
  if (!same(before.card.pilot_image, after.card.pilot_image))
    add('identity', 'Portrait', !before.card.pilot_image ? 'added' : !after.card.pilot_image ? 'removed' : 'updated')
  for (const column of ['appearance', 'personality', 'traits'] as const)
    if (!same(before.card[column], after.card[column])) add(column, capitalise(column), before.card[column] ? 'updated' : 'added', after.card[column], { before: before.card[column] })
  if (!same(before.sheet.backstory, after.sheet.backstory)) add('backstory', 'Backstory', before.sheet.backstory ? 'updated' : 'added', after.sheet.backstory, { before: before.sheet.backstory })

  // Stats and what manna buys.
  stats('personal stats', before.sheet.pilot_stats, after.sheet.pilot_stats, 2)
  stats('piloting stats', before.sheet.mech_skills, after.sheet.mech_skills, 0)
  listChanges('biomods', before.sheet.bionics, after.sheet.bionics, names.bionic, prices?.bionic)
  if (before.sheet.owned_gear) bought.forEach(item => add('loadout', `Bought ${names.gear(item.id)}`, 'added', undefined, { manna: prices?.gear?.(item.id) }))
  else listChanges('loadout', [], owned(after.sheet).map(item => item.id), names.gear)
  descriptions('loadout', gearNotes(before.sheet), gearNotes(after.sheet), names.gear)
  for (const item of owned(after.sheet)) {
    const was = owned(before.sheet).find(o => o.key === item.key)?.damageType
    if (was !== item.damageType) field('loadout', `${names.gear(item.id)} damage type`, was, item.damageType)
  }

  // Mechs: the public list and each mech's private details, by mech id.
  const mechsOf = (card: PublicCard) => (Array.isArray(card.mechs) ? (card.mechs as unknown as PublicMech[]) : [])
  const fromMechs = new Map(mechsOf(before.card).map((m) => [m.id, m]))
  const toMechs = new Map(mechsOf(after.card).map((m) => [m.id, m]))
  // Every mech after the first costs manna: the first one into an empty hangar is free, and so is the last one out.
  let freeAdds = fromMechs.size === 0 ? 1 : 0
  let freeRemoves = toMechs.size === 0 ? 1 : 0
  for (const [id, mech] of fromMechs)
    if (!toMechs.has(id)) {
      mechId = id
      add(`mech: ${mech.name}`, 'Mech scrapped', 'removed', undefined, { manna: freeRemoves-- > 0 ? 0 : -PRICES.extraMech })
    }
  for (const [id, mech] of toMechs) {
    mechId = id
    const old = fromMechs.get(id)
    const section = `mech: ${mech.name}`
    if (!old) {
      add(section, `New mech, ID ${mech.manufacturer_id}`, 'added', undefined, { manna: freeAdds-- > 0 ? 0 : PRICES.extraMech })
      if (mech.appearance) add(`${section} / appearance`, 'Appearance', 'added', mech.appearance)
    }
    else {
      if (old.name !== mech.name) field(`${section} / identity`, 'Name', old.name, mech.name)
      if (old.manufacturer_id !== mech.manufacturer_id) field(`${section} / identity`, 'Manufacturer ID', old.manufacturer_id, mech.manufacturer_id)
      if (!same(old.appearance, mech.appearance)) add(`${section} / appearance`, 'Appearance', old.appearance ? 'updated' : 'added', mech.appearance, { before: old.appearance })
      if (!same(old.image, mech.image)) add(`${section} / appearance`, 'Image', !old.image ? 'added' : !mech.image ? 'removed' : 'updated')
    }
    const a: MechPrivate = before.sheet.mechs?.[id] ?? {}
    const b: MechPrivate = after.sheet.mechs?.[id] ?? {}
    if ((a.frame ?? null) !== (b.frame ?? null))
      field(`${section} / frame`, 'Frame', a.frame && names.frame(a.frame), b.frame && names.frame(b.frame))
    const weapons = (m: MechPrivate) => (m.mounts ?? []).flat().filter((x): x is string => !!x)
    listChanges(`${section} / weapon mounts`, weapons(a), weapons(b), names.weapon)
    const mountChanges = listDiff(weapons(a), weapons(b))
    if (!same(a.mounts ?? [], b.mounts ?? []) && !mountChanges.added.length && !mountChanges.removed.length)
      add(`${section} / weapon mounts`, 'Weapon mounts rearranged')
    listChanges(`${section} / systems`, a.systems, b.systems, names.system)
    descriptions(`${section} / systems`, systemNotes(a), systemNotes(b), names.system)
    const targetName = (m: MechPrivate, key: string) => {
      const target = m.core_mounts?.[key]
      if (target === undefined) return 'Unassigned'
      if (key !== 'cb_overpower_caliber') return `Mount ${target + 1}`
      const weapon = m.mounts?.[Math.floor(target / 2)]?.[target % 2]
      return `Mount ${Math.floor(target / 2) + 1}, ${weapon ? names.weapon(weapon) : 'empty weapon slot'}`
    }
    for (const key of new Set([...Object.keys(a.core_mounts ?? {}), ...Object.keys(b.core_mounts ?? {})]))
      if (!same(a.core_mounts?.[key], b.core_mounts?.[key]))
        add(`${section} / weapon mounts`, `${names.coreBonus(key)} target: ${targetName(a, key)} → ${targetName(b, key)}`)
    const configuration = (options: NonNullable<MechPrivate['weapon_options']>[string] = {}) => [
      ...(options.profile !== undefined ? [`Profile ${options.profile + 1}`] : []), options.type, options.damageType,
      ...(options.accuracy !== undefined ? [options.accuracy ? 'Optics' : 'Reactor shielding'] : []),
      ...(options.smart !== undefined ? [options.smart ? 'Computer' : 'Reactor shielding'] : []),
    ].filter(Boolean).join(', ') || 'Defaults'
    // Each weapon's choices, then its description, named for the weapon it's on (the one it left, when it's gone).
    for (const key of new Set([...Object.keys(a.weapon_options ?? {}), ...Object.keys(b.weapon_options ?? {})])) {
      const [from, to] = [a.weapon_options?.[key], b.weapon_options?.[key]]
      const [mount, place] = key.split(':').map(Number)
      const integrated = key.startsWith('integrated:') ? key.slice('integrated:'.length) : null
      const label = integrated ? names.weapon(integrated) : `Mount ${mount + 1}, weapon ${place + 1}`
      if (configuration(from) !== configuration(to)) add(`${section} / weapon mounts`, `${label} configuration: ${configuration(from)} → ${configuration(to)}`)
      if ((from?.notes ?? '') !== (to?.notes ?? '')) {
        const weapon = integrated ?? (to?.notes ? b : a).mounts?.[mount]?.[place]
        field(`${section} / weapon mounts`, `${weapon ? names.weapon(weapon) : label} description`, from?.notes, to?.notes)
      }
    }
    // A mod sits on a weapon's place: "Mod on Assault Rifle: Nanocomposite Adaptation".
    for (const key of new Set([...Object.keys(a.weapon_mods ?? {}), ...Object.keys(b.weapon_mods ?? {})])) {
      const [from, to] = [a.weapon_mods?.[key], b.weapon_mods?.[key]]
      if (from === to) continue
      const [mount, place] = key.split(':').map(Number)
      const weapon = (to ? b : a).mounts?.[mount]?.[place]
      const label = `Mod on ${weapon ? names.weapon(weapon) : `Mount ${mount + 1}, weapon ${place + 1}`}`
      if (!from) add(`${section} / weapon mounts`, `${label}: ${names.mod(to!)}`, 'added')
      else if (!to) add(`${section} / weapon mounts`, `${label}: ${names.mod(from)}`, 'removed')
      else add(`${section} / weapon mounts`, `${label}: ${names.mod(from)} → ${names.mod(to)}`)
    }
    if (!same(a.history, b.history)) add(`${section} / history`, 'History', a.history ? 'updated' : 'added', b.history, { before: a.history })
  }
  mechId = undefined
  ranks('licences', before.sheet.licences, after.sheet.licences, (id) => `${names.licence(id)} licence`, PRICES.licenceRank)
  // Which frame a licence gives (unset is the licence's own frame): "HA Genghis licence frame: HA Genghis → HA Worldkiller".
  const [oldChoices, newChoices] = [before.sheet.frame_choices ?? {}, after.sheet.frame_choices ?? {}]
  for (const id of new Set([...Object.keys(oldChoices), ...Object.keys(newChoices)])) {
    const [a, b] = [oldChoices[id] ?? id, newChoices[id] ?? id]
    if (a !== b) add('licences', `${names.licence(id)} licence frame: ${names.frame(a)} → ${names.frame(b)}`)
  }
  listChanges('core bonuses', before.sheet.core_bonuses, after.sheet.core_bonuses, names.coreBonus)
  ranks('talents', before.sheet.talents, after.sheet.talents, names.talent, PRICES.talentRank)
  return lines
}

// --- Laying the lines out for the review page: sections in sheet order, with counts and manna ---

export type Tone = 'up' | 'down' | 'info'
// Each kind's tone: up (added, raised), down (removed, lowered) or info (updated).
export const kindTone = (kind: DiffLine['kind']): Tone => (kind === 'added' || kind === 'raised' ? 'up' : kind === 'removed' || kind === 'lowered' ? 'down' : 'info')

export type ReviewSection = {
  id: string // 'identity', 'personal stats', ... or 'mech: Lantern II'
  title: string // 'Identity', 'Mech: Lantern II'
  mech?: string // the mech's name, for a mech
  mechId?: string // and its id: two mechs can share a name
  mechState?: 'new' | 'scrapped'
  groups: { title: string; lines: DiffLine[] }[] // a mech's sub-heads; other sections have one group with no title
  counts: Record<Tone, number>
  manna: number // what the section costs (positive) or refunds (negative)
}

// The sheet's order; mechs follow, in the order the lines name them.
const SECTION_ORDER = ['identity', 'appearance', 'personality', 'traits', 'backstory', 'personal stats', 'piloting stats', 'biomods', 'loadout', 'licences', 'core bonuses', 'talents']
const MECH_GROUPS = ['', 'identity', 'frame', 'appearance', 'history', 'weapon mounts', 'systems']
// Within a group: added and raised first, then updated, then removed and lowered.
const TONE_ORDER: Record<Tone, number> = { up: 0, info: 1, down: 2 }

export function reviewSections(lines: DiffLine[]): ReviewSection[] {
  const sections = new Map<string, ReviewSection>()
  const bySub = new Map<string, DiffLine[]>()
  for (const line of lines) {
    const mech = /^mech: (.+?)(?: \/ (identity|frame|appearance|history|weapon mounts|systems))?$/.exec(line.section)
    const id = mech ? `mech: ${line.mechId ?? mech[1]}` : line.section
    if (!sections.has(id))
      sections.set(id, { id, title: mech ? `Mech: ${mech[1]}` : capitalise(id), ...(mech ? { mech: mech[1], ...(line.mechId ? { mechId: line.mechId } : {}) } : {}), groups: [], counts: { up: 0, down: 0, info: 0 }, manna: 0 })
    const section = sections.get(id)!
    section.counts[kindTone(line.kind)]++
    section.manna += line.manna ?? 0
    if (mech && !mech[2]) section.mechState = line.kind === 'added' ? 'new' : 'scrapped'
    const key = `${id}|${mech?.[2] ?? ''}`
    if (!bySub.has(key)) {
      bySub.set(key, [])
      section.groups.push({ title: mech?.[2] ?? '', lines: bySub.get(key)! })
    }
    bySub.get(key)!.push(line)
  }
  for (const section of sections.values()) {
    section.groups.sort((a, b) => MECH_GROUPS.indexOf(a.title) - MECH_GROUPS.indexOf(b.title))
    for (const group of section.groups) group.lines.sort((a, b) => TONE_ORDER[kindTone(a.kind)] - TONE_ORDER[kindTone(b.kind)])
  }
  const rank = (section: ReviewSection) => (section.mech ? SECTION_ORDER.length : SECTION_ORDER.indexOf(section.id))
  return [...sections.values()].sort((a, b) => rank(a) - rank(b)) // stable: mechs keep their order
}

export const wordCount = (doc: unknown) => docText(doc).split(' ').filter(Boolean).length

// "Backstory rewritten · 412 → 530 words", or "Backstory written · 530 words" when there was nothing before.
// Only for lines that carry writing (a doc); every other line is its own text.
export function writingSummary(line: DiffLine): string | null {
  if (line.doc === undefined) return null
  const words = wordCount(line.doc)
  if (!words) return `${line.text} cleared`
  return line.before ? `${line.text} rewritten · ${wordCount(line.before)} → ${words} words` : `${line.text} written · ${words} words`
}
