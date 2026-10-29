import type { Json } from './lib/database.types'
import type { MechPrivate, Sheet } from './myPilot'
import type { PublicMech } from './pilots'
import { rankName } from './rules'

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
}

export type DiffLine = {
  section: string
  text: string
  kind: 'addition' | 'removal' | 'edit'
  display?: string
  increase?: number
  doc?: Json | null
}

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
): DiffLine[] {
  const lines: DiffLine[] = []
  const add = (section: string, text: string, kind: DiffLine['kind'] = 'edit', extra: Pick<DiffLine, 'display' | 'doc' | 'increase'> = {}) =>
    lines.push({ section, text, kind, ...extra })
  const listChanges = <T>(section: string, from: T[] | undefined, to: T[] | undefined, name: (item: T) => string) => {
    const { added, removed } = listDiff(from, to)
    added.forEach((item) => add(section, `added ${name(item)}`, 'addition'))
    removed.forEach((item) => add(section, `removed ${name(item)}`, 'removal'))
  }
  const ranks = (section: string, from: Record<string, number> = {}, to: Record<string, number> = {}, name: (id: string) => string) => {
    for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const [a, b] = [from[id] ?? 0, to[id] ?? 0]
      if (a !== b) add(section, a === 0 ? `${name(id)}: new at rank ${rankName(b)}` : b === 0 ? `${name(id)}: dropped` : `${name(id)}: rank ${rankName(a)} → ${rankName(b)}`,
        b > a ? 'addition' : 'removal', { display: b > a ? `${name(id)}: rank ${rankName(b)}` : undefined, increase: b > a ? b - a : undefined })
    }
  }
  const stats = (section: string, from: Record<string, number> = {}, to: Record<string, number> = {}, start: number) => {
    for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const [a, b] = [from[id] ?? start, to[id] ?? start]
      if (a !== b) add(section, `${names.stat(id)} ${a} → ${b}`, b > a ? 'addition' : 'removal',
        { display: b > a ? `${names.stat(id)}: ${b}` : undefined, increase: b > a ? b - a : undefined })
    }
  }

  // Public card.
  for (const column of ['pilot_name', 'callsign', 'age', 'gender', 'sexuality', 'height', 'weight', 'eye_colour', 'hair_colour'] as const)
    if (!same(before.card[column], after.card[column]))
      add('identity', `${column.replace('_', ' ')}: ${shown(before.card[column])} → ${shown(after.card[column])}`,
        shown(before.card[column]) === '-' ? 'addition' : shown(after.card[column]) === '-' ? 'removal' : 'edit',
        { display: `${column.replace('_', ' ')}: ${shown(after.card[column])}` })
  if (!same(before.card.pilot_image, after.card.pilot_image))
    add('identity', 'portrait changed', before.card.pilot_image ? 'edit' : 'addition')
  for (const column of ['appearance', 'personality', 'traits'] as const)
    if (!same(before.card[column], after.card[column])) add(column, `${column} updated`, before.card[column] ? 'edit' : 'addition', { doc: after.card[column] })
  if (!same(before.sheet.backstory, after.sheet.backstory)) add('backstory', 'backstory updated', before.sheet.backstory ? 'edit' : 'addition', { doc: after.sheet.backstory })

  // Stats and what manna buys.
  stats('personal stats', before.sheet.pilot_stats, after.sheet.pilot_stats, 2)
  stats('piloting stats', before.sheet.mech_skills, after.sheet.mech_skills, 0)
  listChanges('bionics', before.sheet.bionics, after.sheet.bionics, names.bionic)
  listChanges('loadout', before.sheet.pilot_gear, after.sheet.pilot_gear, names.gear)

  // Mechs: the public list and each mech's private details, by mech id.
  const mechsOf = (card: PublicCard) => (Array.isArray(card.mechs) ? (card.mechs as unknown as PublicMech[]) : [])
  const fromMechs = new Map(mechsOf(before.card).map((m) => [m.id, m]))
  const toMechs = new Map(mechsOf(after.card).map((m) => [m.id, m]))
  for (const [id, mech] of fromMechs) if (!toMechs.has(id)) add('mech hangar', `scrapped ${mech.name}`, 'removal')
  for (const [id, mech] of toMechs) {
    const old = fromMechs.get(id)
    const section = `mech: ${mech.name}`
    if (!old) {
      add('mech hangar', `new mech ${mech.name} (${mech.manufacturer_id})`, 'addition')
      if (mech.appearance) add(`${section} / appearance`, 'appearance', 'addition', { doc: mech.appearance })
    }
    else {
      if (old.name !== mech.name) add(`${section} / identity`, `renamed from ${old.name}`)
      if (old.manufacturer_id !== mech.manufacturer_id) add(`${section} / identity`, `manufacturer id: ${old.manufacturer_id} → ${mech.manufacturer_id}`)
      if (!same(old.appearance, mech.appearance)) add(`${section} / appearance`, 'appearance updated', 'edit', { doc: mech.appearance })
      if (!same(old.image, mech.image)) add(`${section} / appearance`, 'image changed')
    }
    const a: MechPrivate = before.sheet.mechs?.[id] ?? {}
    const b: MechPrivate = after.sheet.mechs?.[id] ?? {}
    if ((a.frame ?? null) !== (b.frame ?? null))
      add(`${section} / frame`, `frame: ${a.frame ? names.frame(a.frame) : '-'} → ${b.frame ? names.frame(b.frame) : '-'}`, a.frame ? 'edit' : 'addition', { display: `frame: ${b.frame ? names.frame(b.frame) : '-'}` })
    const weapons = (m: MechPrivate) => (m.mounts ?? []).flat().filter((x): x is string => !!x)
    listChanges(`${section} / weapon mounts`, weapons(a), weapons(b), names.weapon)
    const mountChanges = listDiff(weapons(a), weapons(b))
    if (!same(a.mounts ?? [], b.mounts ?? []) && !mountChanges.added.length && !mountChanges.removed.length)
      add(`${section} / weapon mounts`, 'weapon mounts rearranged')
    listChanges(`${section} / systems`, a.systems, b.systems, names.system)
    const targetName = (m: MechPrivate, key: string) => {
      const target = m.core_mounts?.[key]
      if (target === undefined) return 'unassigned'
      if (key !== 'cb_overpower_caliber') return `mount ${target + 1}`
      const weapon = m.mounts?.[Math.floor(target / 2)]?.[target % 2]
      return `mount ${Math.floor(target / 2) + 1}, ${weapon ? names.weapon(weapon) : 'empty weapon slot'}`
    }
    for (const key of new Set([...Object.keys(a.core_mounts ?? {}), ...Object.keys(b.core_mounts ?? {})]))
      if (!same(a.core_mounts?.[key], b.core_mounts?.[key]))
        add(`${section} / weapon mounts`, `${names.coreBonus(key)} target: ${targetName(a, key)} → ${targetName(b, key)}`)
    const configuration = (options: NonNullable<MechPrivate['weapon_options']>[string] = {}) => [
      ...(options.profile !== undefined ? [`profile ${options.profile + 1}`] : []), options.type, options.damageType,
      ...(options.accuracy !== undefined ? [options.accuracy ? 'optics' : 'reactor shielding'] : []),
      ...(options.smart !== undefined ? [options.smart ? 'computer' : 'reactor shielding'] : []),
    ].filter(Boolean).join(', ') || 'defaults'
    for (const key of new Set([...Object.keys(a.weapon_options ?? {}), ...Object.keys(b.weapon_options ?? {})]))
      if (!same(a.weapon_options?.[key], b.weapon_options?.[key])) {
        const [mount, place] = key.split(':').map(Number)
        const label = key.startsWith('integrated:') ? names.weapon(key.slice('integrated:'.length)) : `mount ${mount + 1}, weapon ${place + 1}`
        add(`${section} / weapon mounts`, `${label} configuration: ${configuration(a.weapon_options?.[key])} → ${configuration(b.weapon_options?.[key])}`)
      }
    if (!same(a.history, b.history)) add(`${section} / history`, 'history updated', a.history ? 'edit' : 'addition', { doc: b.history })
  }
  ranks('licences', before.sheet.licences, after.sheet.licences, (id) => `${names.licence(id)} licence`)
  listChanges('core bonuses', before.sheet.core_bonuses, after.sheet.core_bonuses, names.coreBonus)
  ranks('talents', before.sheet.talents, after.sheet.talents, names.talent)
  return lines
}
