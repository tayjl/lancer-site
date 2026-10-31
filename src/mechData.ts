import { shallowRef } from 'vue'
import armourIcon from './assets/icons/armour.svg'
import evasionIcon from './assets/icons/evasion.svg'
import eDefIcon from './assets/icons/e_def.svg'
import heatIcon from './assets/icons/heat.svg'
import hpIcon from './assets/icons/hp.svg'
import stressIcon from './assets/icons/reactor.svg'
import repairIcon from './assets/icons/repair.svg'
import structureIcon from './assets/icons/structure.svg'
import systemPointIcon from './assets/icons/system_point.svg'
import speedIcon from './assets/icons/speed.svg'
import techAttackIcon from './assets/icons/tech_attack.svg'
import { loadoutSlots, loadTagNames, toItem, type Bonus, type CoreBonus, type Item, type Talent } from './gameData'
import { supabase } from './lib/supabaseClient'
import type { MechPrivate, Sheet } from './myPilot'
import { bonusValue, permanentBonus, resolveBonuses, type NamedBonus } from './bonuses'
import { averageDamageText } from './damage'
import { selectWeaponProfile } from './equipment'
import { CORE_CHECK_BONUSES } from './coreRules'

// The mech page's catalogues (frames, mech weapons, systems, from the imported LANCER packs) and its rules:
// which weapons fit which mount, and the mech's stats. Mechs only store ids; everything else comes from here.

// A frame as lancer-data has it, cut down: its mounts (e.g. Flex, Main, Heavy), its base stats, the licence
// rank it needs in its own licence (2; 0 for GMS frames) and the weapons and systems built into it.
export type Frame = {
  id: string
  name: string
  source: string
  licenceLevel: number
  integrated: string[]
  mechtype: string[]
  mounts: string[]
  stats: Record<string, number>
  description: string
  raw?: Record<string, unknown>
}

// Which weapon sizes each place on a mount takes. Most mounts hold one weapon; Flex, Main/Aux and Aux/Aux hold two.
const MOUNT_SLOTS: Record<string, string[][]> = {
  Auxiliary: [['Auxiliary']],
  'Integrated Auxiliary': [['Auxiliary']],
  Main: [['Main', 'Auxiliary']],
  // A Superheavy weapon also needs a second, empty mount: see bracingMount() in src/rules.ts.
  Heavy: [['Superheavy', 'Heavy', 'Main', 'Auxiliary']],
  Flex: [['Main', 'Auxiliary'], ['Auxiliary']],
  'Main/Aux': [['Main', 'Auxiliary'], ['Auxiliary']],
  'Aux/Aux': [['Auxiliary'], ['Auxiliary']],
}

// How many weapons a mount holds.
export const mountSize = (mount: string) => MOUNT_SLOTS[mount]?.length ?? 1

// The weapon sizes place "index" on a mount takes, given the sizes already on it (null where empty).
// A Flex mount holds one Main weapon or two Auxiliary ones, so a Main weapon closes its second place.
export function allowedSizes(mount: string, index: number, sizesOnMount: (string | null)[]) {
  const allowed = MOUNT_SLOTS[mount]?.[index] ?? []
  if (mount !== 'Flex') return allowed
  if (index === 0) return sizesOnMount[1] ? ['Auxiliary'] : allowed
  return sizesOnMount[0] === 'Main' ? [] : allowed
}

// LANCER's mech stats, in COMP/CON's order, with their symbols (src/assets/icons: COMP/CON's, plus Material
// Design's heart and shield, as COMP/CON uses for hp and armour). Worked out from the frame and the pilot's
// HASE (unset skills count as 0, like the pilot sheet), never stored. No grit (homebrew rule).
const MECH_STATS = [
  ['structure', 'structure', structureIcon],
  ['stress', 'stress', stressIcon],
  ['hp', 'hp', hpIcon],
  ['heat', 'heat cap', heatIcon],
  ['armour', 'armour', armourIcon],
  ['evasion', 'evasion', evasionIcon],
  ['speed', 'speed', speedIcon],
  ['edef', 'e-defence', eDefIcon],
  ['tech_attack', 'tech attack', techAttackIcon],
  ['repair', 'repair cap', repairIcon],
  ['system_points', 'system points', systemPointIcon],
  ['size', 'size', undefined],
] as const

const BONUS_STATS: Record<string, string> = {
  structure: 'structure', stress: 'stress', hp: 'hp', heatcap: 'heat', heat_cap: 'heat',
  armor: 'armour', evasion: 'evasion', speed: 'speed', edef: 'edef',
  tech_attack: 'tech_attack', repcap: 'repair', sp: 'system_points',
  size: 'size', armor_max: 'armor_max', ai_cap: 'ai_cap', limited_bonus: 'limited_bonus',
}
export type StatModifier = { stat: string; source: string; value: number; replace: boolean; overwrite: boolean }
export type EffectCatalogue = {
  frames?: Frame[]
  weapons: Map<string, Item>
  systems: Map<string, Item>
  integrated: Map<string, Item>
  talents?: Talent[]
  coreBonuses?: CoreBonus[]
  gear?: Item[]
}

export function talentGrants(sheet: Sheet, talents: Talent[]) {
  const integrated = new Set<string>(), optional = new Set<string>()
  for (const talent of talents) {
    const rank = sheet.talents?.[talent.id] ?? 0
    const ranks = talent.ranks.slice(0, Number.isInteger(rank) ? Math.max(0, Math.min(3, rank)) : 0)
    const exclusive = ranks.reduce((last, entry, index) => entry.exclusive ? index : last, -1)
    ranks.forEach((entry, index) => {
      if (entry.exclusive && index !== exclusive) return
      for (const id of entry.integrated ?? []) integrated.add(id)
      for (const id of entry.special_equipment ?? []) optional.add(id)
    })
  }
  return { integrated: [...integrated], optional: [...optional] }
}

export function buildFrame(frame: Frame | null, mech: MechPrivate, sheet: Sheet, talents: Talent[], bonuses: NamedBonus[] = []): Frame | null {
  if (!frame) return null
  const mounts = [...frame.mounts]
  const taken = new Set(sheet.core_bonuses ?? [])
  if (taken.has('cb_improved_armament') && mounts.length < 3) mounts.push('Flex')
  if (taken.has('cb_mount_retrofitting')) {
    const index = mech.core_mounts?.cb_mount_retrofitting
    if (Number.isInteger(index) && index! >= 0 && index! < mounts.length) mounts[index!] = 'Main/Aux'
  }
  for (const { bonus } of bonuses) {
    if (bonus.id !== 'add_mount' || !permanentBonus(bonus)) continue
    const type = String(bonus.val)
    if (type in MOUNT_SLOTS && (!Number.isFinite(bonus.max) || mounts.length < Number(bonus.max)) && mounts.length < 20) mounts.push(type)
  }
  if (taken.has('cb_integrated_weapon')) mounts.push('Integrated Auxiliary')
  return { ...frame, mounts, integrated: [...new Set([...frame.integrated, ...talentGrants(sheet, talents).integrated])] }
}

export const buildVariables = (sheet: Sheet, frame?: Frame | null) => ({
  ll: Object.values(sheet.licences ?? {}).reduce((sum, rank) => sum + rank, 0),
  hull: sheet.mech_skills?.hull ?? 0, agility: sheet.mech_skills?.agility ?? 0,
  systems: sheet.mech_skills?.systems ?? 0, engineering: sheet.mech_skills?.engineering ?? 0,
  size: frame?.stats.size ?? 1,
})

// Only equipped equipment and purchased talent ranks contribute. Actions, active core powers, conditional and
// unsupported bonuses remain explicit reminders: guessing whether a conditional effect is active would give
// misleading totals. Equipped items' rules aren't repeated: their own loadout cards already show them.
export function mechEffects(mech: MechPrivate, sheet: Sheet, catalogue: EffectCatalogue) {
  const sources: { name: string; bonuses: Bonus[] }[] = []
  const reminders: { source: string; text: string }[] = []
  const addItem = (id: string, items: Map<string, Item>, key = id) => {
    const item = items.get(id) ?? catalogue.integrated.get(id)
    if (item) {
      const selected = selectWeaponProfile(item, mech.weapon_options?.[key]?.profile ?? 0)
      addRaw(selected.name, '', { ...selected.raw, bonuses: selected.bonuses }, false)
    }
    else reminders.push({ source: id, text: 'Content unavailable; its bonuses are not included.' })
  }
  // A Unique item duplicated on an invalid loadout must not grant its bonuses twice.
  const baseFrame = catalogue.frames?.find(frame => frame.id === mech.frame)
  const mountSources = [
    ...(catalogue.coreBonuses ?? []).filter(bonus => sheet.core_bonuses?.includes(bonus.id)),
    ...(catalogue.talents ?? []).flatMap(talent => talent.ranks.slice(0, Math.min(3, Math.max(0, sheet.talents?.[talent.id] ?? 0)))),
    ...(mech.systems ?? []).flatMap(id => { const item = catalogue.systems.get(id) ?? catalogue.integrated.get(id); return item ? [item] : [] }),
    ...(baseFrame?.raw ? [baseFrame.raw, ...(Array.isArray(baseFrame.raw.traits) ? baseFrame.raw.traits as Record<string, unknown>[] : [])] : []),
    ...(baseFrame?.raw?.core_system ? [{ bonuses: (baseFrame.raw.core_system as Record<string, unknown>).passive_bonuses }] : []),
  ]
  const mountBonuses = mountSources.flatMap(source => Array.isArray(source.bonuses) ? (source.bonuses as Bonus[]).filter(bonus => bonus?.id === 'add_mount').map(bonus => ({ source: '', bonus })) : [])
  const frame = buildFrame(baseFrame ?? null, mech, sheet, catalogue.talents ?? [], mountBonuses)
  const addRaw = (name: string, text: unknown, raw: Record<string, unknown>, remind = true) => {
    sources.push({ name, bonuses: Array.isArray(raw.bonuses) ? raw.bonuses as Bonus[] : [] })
    if (!remind) return
    if (text) reminders.push({ source: name, text: averageDamageText(String(text)) })
    // Not "synergies": COMP/CON's hints that repeat the rules text already listed.
    for (const key of ['actions', 'active_actions', 'passive_actions', 'active_effects']) {
      if (!Array.isArray(raw[key])) continue
      for (const action of raw[key] as Record<string, unknown>[]) {
        if (!action || typeof action !== 'object' || !(action.detail || action.description)) continue
        // "Reactive Code · reaction" rather than "Reactive Code · Reactive Code".
        const label = action.name && name.endsWith(String(action.name)) ? String(action.activation ?? 'action').toLowerCase() : action.name ?? key.replaceAll('_', ' ')
        reminders.push({ source: `${name} · ${label}`, text: averageDamageText(String(action.detail ?? action.description)) })
      }
    }
  }
  if (baseFrame?.raw) {
    // The frame's description is lore, not rules.
    addRaw(baseFrame.name, '', baseFrame.raw)
    for (const trait of (Array.isArray(baseFrame.raw.traits) ? baseFrame.raw.traits : []) as Record<string, unknown>[])
      addRaw(`${baseFrame.name} · ${trait.name ?? 'trait'}`, trait.description, trait)
    const core = baseFrame.raw.core_system as Record<string, unknown> | undefined
    if (core) {
      addRaw(`${core.name ?? 'core system'} · passive`, core.passive_effect, { ...core, bonuses: core.passive_bonuses ?? [] })
      if (core.active_effect) reminders.push({ source: `${core.active_name ?? core.name} · active core power`, text: averageDamageText(String(core.active_effect)) })
    }
  }
  if (baseFrame && CORE_CHECK_BONUSES[baseFrame.id]) sources.push({ name: baseFrame.name, bonuses: CORE_CHECK_BONUSES[baseFrame.id] })
  // Pilot gear only counts for any mech bonuses it has (homebrew); its rules and pilot_* bonuses stay on the pilot.
  if (catalogue.gear) {
    const byId = new Map(catalogue.gear.map(item => [item.id, item]))
    const layout = loadoutSlots(sheet.pilot_gear ?? [], id => byId.get(id)?.type)
    for (const slot of layout.slots) {
      const item = slot.id ? byId.get(slot.id) : undefined
      if (item) sources.push({ name: item.name, bonuses: item.bonuses.filter(bonus => !bonus.id.startsWith('pilot_')) })
    }
  }
  const mounts = frame ? (mech.mounts ?? []).slice(0, frame.mounts.length).map((places, index) => places.slice(0, mountSize(frame.mounts[index]))) : mech.mounts ?? []
  const builtIn = new Set(frame?.integrated ?? [])
  for (const id of builtIn) addItem(id, catalogue.integrated, `integrated:${id}`)
  const equipped = [...(mech.systems ?? []).map(id => ({ id, items: catalogue.systems })),
    ...mounts.flatMap((places, m) => places.flatMap((id, i) => id ? [{ id, items: catalogue.weapons, key: `${m}:${i}` }] : []))].filter(entry => !builtIn.has(entry.id))
  const unique = new Set<string>()
  for (const entry of equipped) {
    const { id, items } = entry
    const item = items.get(id) ?? catalogue.integrated.get(id)
    if (item?.tags.some(tag => tag.id === 'tg_unique')) {
      if (unique.has(id)) continue
      unique.add(id)
    }
    addItem(id, items, 'key' in entry ? String(entry.key) : id)
  }
  for (const id of new Set(sheet.core_bonuses ?? [])) {
    const bonus = catalogue.coreBonuses?.find(bonus => bonus.id === id)
    if (bonus) {
      addRaw(bonus.name, bonus.effect, bonus)
      if (CORE_CHECK_BONUSES[id]) sources.push({ name: bonus.name, bonuses: CORE_CHECK_BONUSES[id] })
    }
    else reminders.push({ source: id, text: 'Core bonus unavailable; its bonuses are not included.' })
  }
  for (const [id, rank] of Object.entries(sheet.talents ?? {})) {
    if (!Number.isInteger(rank) || rank <= 0) continue
    const talent = catalogue.talents?.find(talent => talent.id === id)
    if (!talent) reminders.push({ source: id, text: 'Talent unavailable; its bonuses are not included.' })
    talent?.ranks.slice(0, Math.min(rank, 3)).forEach((entry, index) => {
      addRaw(`${talent.name} ${index + 1}: ${entry.name}`, entry.description, entry)
    })
  }
  const modifiers: StatModifier[] = []
  const bonuses: NamedBonus[] = []
  for (const source of sources) {
    for (const bonus of source.bonuses) {
      if (!bonus || typeof bonus !== 'object') continue
      if (bonus.id === 'pilot_evasion') continue
      bonuses.push({ source: source.name, bonus })
      const stat = BONUS_STATS[bonus.id]
      const calculated = bonusValue(bonus.val, buildVariables(sheet, frame))
      const numeric = calculated !== null
      const value = calculated ?? NaN
      // Filters, expressions and conditions require game state that this character manager doesn't track.
      const unsupported = !permanentBonus(bonus) || Object.keys(bonus).some(key => !['id', 'val', 'replace', 'overwrite', 'condition', 'detail', 'damage_types', 'range_types', 'weapon_types', 'weapon_sizes'].includes(key))
      if (stat && Number.isFinite(value) && !unsupported
        && (bonus.replace === undefined || typeof bonus.replace === 'boolean')
        && (bonus.overwrite === undefined || typeof bonus.overwrite === 'boolean'))
        modifiers.push({ stat, source: source.name, value, replace: !!bonus.replace, overwrite: !!bonus.overwrite })
      else if (bonus.condition || bonus.detail || (!['range', 'damage', 'attack', 'threat', 'add_mount', 'overcharge', 'cheap_struct', 'superheavy_mounting', 'drone_hp', 'deployable_hp'].includes(bonus.id) && bonus.accuracy === undefined)) reminders.push({ source: source.name, text: bonusReminder(bonus, numeric ? value : null) })
    }
  }
  return { modifiers, bonuses, reminders }
}

// "+10 hp, only when exposed: not counted in the stats above." Bonus ids and {braces} are data, not wording.
function bonusReminder(bonus: Bonus, value: number | null) {
  const what = `${value === null ? '' : `${value >= 0 ? '+' : ''}${value} `}${String(bonus.id ?? 'unknown bonus').replaceAll('_', ' ')}`
  const when = bonus.condition ? `, only when ${String(bonus.condition).replace(/[{}]/g, '')}` : ''
  return `${what}${when}: not counted in the stats above.${bonus.detail ? ` ${bonus.detail}` : ''}`
}

export function mechResources(sheet: Sheet, effects: ReturnType<typeof mechEffects>) {
  const count = (id: string, base = 0) => resolveBonuses(base, effects.modifiers.filter(entry => entry.stat === id)).value
  const overcharge = effects.bonuses.find(entry => entry.bonus.id === 'overcharge' && permanentBonus(entry.bonus) && Array.isArray(entry.bonus.val))
  const checks = effects.bonuses.filter(entry => !entry.bonus.condition && !entry.bonus.detail && typeof entry.bonus.accuracy === 'number' && !['attack', 'melee'].includes(entry.bonus.id))
    .map(entry => ({ source: entry.source, text: `${Number(entry.bonus.accuracy) >= 0 ? '+' : ''}${entry.bonus.accuracy} accuracy on ${entry.bonus.id.replaceAll('_', ' ')} checks` }))
  return {
    aiCap: Math.max(0, count('ai_cap', 1)),
    limited: Math.floor((sheet.mech_skills?.engineering ?? 0) / 2) + count('limited_bonus'),
    overcharge: overcharge ? (overcharge.bonus.val as unknown as string[]).join(' → ') : '1 → 1d3 → 1d6 → 1d6+4',
    structureRepairs: effects.bonuses.some(entry => entry.bonus.id === 'cheap_struct' && permanentBonus(entry.bonus) && bonusValue(entry.bonus.val) === 1) ? 1 : 2,
    superheavyMounting: effects.bonuses.some(entry => entry.bonus.id === 'superheavy_mounting' && permanentBonus(entry.bonus) && entry.bonus.val !== 0 && entry.bonus.val !== '0'),
    checks,
  }
}

export function mechStats(frame: Frame | null, skills: Record<string, number> | undefined, modifiers: StatModifier[] = []) {
  const skill = (id: string) => skills?.[id] ?? 0
  const s = frame?.stats ?? {}
  const values: Record<string, number> = {
    structure: s.structure,
    stress: s.stress,
    hp: s.hp + 2 * skill('hull'),
    heat: s.heatcap + skill('engineering'),
    armour: s.armor,
    evasion: s.evasion + skill('agility'),
    speed: s.speed + Math.floor(skill('agility') / 2),
    edef: s.edef + skill('systems'),
    tech_attack: s.tech_attack + skill('systems'),
    repair: s.repcap + Math.floor(skill('hull') / 2),
    system_points: s.sp + Math.floor(skill('systems') / 2),
    size: s.size ?? 1,
  }
  const hase: Record<string, [string, number]> = {
    hp: ['hull', 2 * skill('hull')], heat: ['engineering', skill('engineering')],
    evasion: ['agility', skill('agility')], speed: ['agility', Math.floor(skill('agility') / 2)],
    edef: ['systems', skill('systems')], tech_attack: ['systems', skill('systems')],
    repair: ['hull', Math.floor(skill('hull') / 2)], system_points: ['systems', Math.floor(skill('systems') / 2)],
  }
  return MECH_STATS.map(([id, name, icon]) => {
    const matching = modifiers.filter(modifier => modifier.stat === id)
    const resolved = resolveBonuses(values[id], matching)
    let value = resolved.value
    const contributors = !resolved.usesBase ? [] : [
      `${frame?.name ?? 'frame'}: ${values[id] - (hase[id]?.[1] ?? 0)}`,
      ...(hase[id]?.[1] ? [`${hase[id][0]}: +${hase[id][1]}`] : []),
    ]
    for (const entry of resolved.used) contributors.push(`${entry.source}: ${entry.replace ? 'sets base to ' : entry.value >= 0 ? '+' : ''}${entry.value}${entry.overwrite && !entry.replace ? ' (highest override)' : ''}`)
    const armourMax = resolveBonuses(4, modifiers.filter(entry => entry.stat === 'armor_max')).value
    if (id === 'armour' && value > armourMax) { value = armourMax; contributors.push(`armour maximum: ${armourMax}`) }
    if (id === 'size' && matching.length) {
      const steps = [0.5, 1, 2, 3]
      value = resolved.usesBase ? steps[Math.min(3, Math.max(0, steps.indexOf(s.size ?? 1) + Math.trunc(value - (s.size ?? 1))))] : Math.min(3, Math.max(0.5, value))
    }
    return { id, name, icon, value: frame ? value : null, contributors: frame ? contributors : [] }
  })
}

// Every "integrated" list inside a frame (core systems and traits): weapons and systems built into it.
function integratedIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(integratedIds)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, inner]) =>
    key === 'integrated' && Array.isArray(inner) ? inner.map(String) : integratedIds(inner),
  )
}

export function useMechData() {
  const frames = shallowRef<Frame[]>([])
  const weapons = shallowRef<Item[]>([])
  const systems = shallowRef<Item[]>([])
  // Weapons and systems built into frames, by id: shown on the mech, never picked.
  const integrated = shallowRef(new Map<string, Item>())

  async function load() {
    loadTagNames()
    const { data } = await supabase.from('content_items').select('id, kind, data').in('kind', ['frames', 'weapons', 'systems', 'talents'])
    const rows = data ?? []
    const frameRows = rows.filter((row) => row.kind === 'frames')
    // Built-in and talent-only items can't be picked: they come with a frame or a talent.
    const talentEquipment = rows.filter(row => row.kind === 'talents').flatMap(row => {
      const ranks = (row.data as unknown as Talent)?.ranks ?? []
      return ranks.flatMap(rank => [...(rank.integrated ?? []), ...(rank.special_equipment ?? [])])
    })
    const builtIn = new Set([...frameRows.flatMap((row) => integratedIds(row.data)), ...talentEquipment])
    const pickable = (kind: string) =>
      rows
        .filter((row) => row.kind === kind && !builtIn.has(row.id) && !(row.data as { talent_item?: boolean } | null)?.talent_item)
        .map((row) => toItem(row.id, row.data))

    integrated.value = new Map(
      rows.filter((row) => row.kind !== 'frames' && (builtIn.has(row.id) || (row.data as { talent_item?: boolean })?.talent_item)).map((row) => [row.id, toItem(row.id, row.data)]),
    )
    frames.value = frameRows
      .map(({ id, data }) => {
        const frame = (data ?? {}) as Record<string, unknown>
        return {
          id,
          name: String(frame.name ?? id),
          source: String(frame.source ?? ''),
          licenceLevel: Number(frame.license_level ?? 0) || 0,
          integrated: integratedIds(frame),
          mechtype: Array.isArray(frame.mechtype) ? frame.mechtype.map(String) : [],
          mounts: Array.isArray(frame.mounts) ? frame.mounts.map(String) : [],
          stats: (frame.stats ?? {}) as Record<string, number>,
          description: String(frame.description ?? ''),
          raw: frame,
        }
      })
      .sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name))
    weapons.value = pickable('weapons').sort((a, b) => a.name.localeCompare(b.name))
    systems.value = pickable('systems').sort((a, b) => a.name.localeCompare(b.name))
  }

  load()

  return { frames, weapons, systems, integrated }
}
