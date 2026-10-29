import { bonusValue, resolveBonuses, type NamedBonus } from './bonuses'
import { averageDamage } from './damage'
import { toItem, type Item } from './gameData'
import type { MechPrivate, Sheet } from './myPilot'

export function selectWeaponProfile(item: Item, index = 0): Item {
  const profile = item.profiles?.[index]
  if (!profile) return item
  const selected = toItem(item.id, { ...item.raw, ...profile, name: `${item.name} · ${profile.name ?? `profile ${index + 1}`}`, profiles: [] })
  return { ...selected, profiles: item.profiles, raw: item.raw, bonuses: [...item.bonuses, ...(Array.isArray(profile.bonuses) ? profile.bonuses : [])] }
}

function matches(entry: NamedBonus, item: Item, rangeType?: string, damageType?: string) {
  const b = entry.bonus
  if (b.condition || b.detail) return false
  for (const [key, values] of Object.entries({ weapon_types: [item.type], weapon_sizes: [item.mount], range_types: rangeType ? [rangeType] : item.range.map(range => range.type), damage_types: damageType ? [damageType] : item.damage.map(damage => damage.type) })) {
    const filter = b[key]
    if (Array.isArray(filter) && filter.length && !values.some(value => filter.some(allowed => String(allowed).toLowerCase() === value.toLowerCase()))) return false
  }
  return true
}

export function equipmentDetails(item: Item, sheet: Sheet, bonuses: NamedBonus[], options?: NonNullable<MechPrivate['weapon_options']>[string], location?: { mount: number; position: number; integrated?: boolean }, coreMounts: Record<string, number> = {}) {
  let selected = selectWeaponProfile(item, options?.profile)
  if (item.id.startsWith('mw_prototype_')) {
    const type = options?.type ?? 'Rifle', damageType = options?.damageType ?? 'Kinetic'
    selected = { ...selected, type, damage: selected.damage.map(damage => ({ ...damage, type: damageType })), range: selected.range.filter(range => range.type === (type === 'Melee' ? 'Threat' : 'Range')) }
  }
  const variables = { ll: Object.values(sheet.licences ?? {}).reduce((sum, value) => sum + value, 0), ...sheet.mech_skills }
  const sources: string[] = []
  const applicable = (ids: string[], range?: string, damage?: string) => bonuses.filter(entry => ids.includes(entry.bonus.id) && matches(entry, selected, range, damage)).flatMap(entry => {
    const value = bonusValue(entry.bonus.val, variables)
    return value === null ? [] : [{ source: entry.source, value, replace: !!entry.bonus.replace, overwrite: !!entry.bonus.overwrite }]
  })
  const range = selected.range.map(range => {
    const entries = applicable(['range', ...(range.type === 'Threat' ? ['threat'] : [])], range.type)
    const base = bonusValue(range.val, variables)
    if (base === null) return range
    const result = resolveBonuses(base, entries.map(entry => ({ ...entry, overwrite: false })))
    for (const entry of result.used) sources.push(`${entry.source}: ${entry.value >= 0 ? '+' : ''}${entry.value} ${range.type.toLowerCase()}`)
    return { ...range, val: Math.max(0, result.value) }
  })
  if ((sheet.talents?.t_hunter ?? 0) >= 2 && selected.type === 'Melee' && selected.mount === 'Auxiliary') {
    const thrown = range.find(entry => entry.type === 'Thrown')
    if (thrown) thrown.val = Math.max(5, Number(thrown.val) || 0)
    else range.push({ type: 'Thrown', val: 5 })
    sources.push('Hunter II: Thrown 5 (or existing higher Thrown); thrown weapons return at end of turn.')
  }
  const damage = selected.damage.map(damage => {
    const entries = bonuses.filter(entry => entry.bonus.id === 'damage' && matches(entry, selected, undefined, damage.type)).flatMap(entry => {
      const numeric = bonusValue(entry.bonus.val, variables)
      const expression = numeric === null ? String(entry.bonus.val) : String(numeric)
      return typeof averageDamage(expression) === 'number' ? [{ source: entry.source, expression }] : []
    })
    for (const entry of entries) sources.push(`${entry.source}: ${entry.expression.startsWith('-') ? '' : '+'}${entry.expression} ${damage.type.toLowerCase()} damage (before averaging)`)
    // Round once after summing the complete dice expression and its modifiers.
    return { ...damage, val: averageDamage(`${damage.val}${entries.map(entry => `${entry.expression.startsWith('-') ? '' : '+'}${entry.expression}`).join('')}`) }
  })
  const already = selected.range.find(range => range.type === 'Thrown')
  if (already) {
    const added = range.find(range => range.type === 'Thrown')
    if (added) added.val = Math.max(Number(already.val) || 0, Number(added.val) || 0)
  }
  const limited = (sheet.mech_skills?.engineering ?? 0) / 2
  const tags = selected.tags.map(tag => {
    if (tag.id !== 'tg_limited') return tag
    const entries = applicable(['limited_bonus'])
    const extra = Math.floor(limited) + entries.reduce((sum, entry) => sum + entry.value, 0)
    if (Math.floor(limited)) sources.push(`engineering: +${Math.floor(limited)} limited uses`)
    for (const entry of entries) sources.push(`${entry.source}: +${entry.value} limited uses`)
    const base = bonusValue(tag.val, variables)
    return { ...tag, val: base === null ? `${tag.val}${extra ? `+${extra}` : ''}` : base + extra }
  })
  const accuracy = bonuses.filter(entry => ['attack', 'melee'].includes(entry.bonus.id) && matches(entry, selected)).reduce((sum, entry) => sum + (entry.bonus.id !== 'melee' || selected.type === 'Melee' ? bonusValue(entry.bonus.accuracy, variables) ?? 0 : 0), 0)
  const attack = applicable(['attack']).reduce((sum, entry) => sum + entry.value, 0)
  if (attack) sources.push(`attack roll bonus: ${attack >= 0 ? '+' : ''}${attack}`)
  const auto = location && !location.integrated && sheet.core_bonuses?.includes('cb_auto_stabilizing_hardpoints') && coreMounts.cb_auto_stabilizing_hardpoints === location.mount ? 1 : 0
  const optics = item.id.startsWith('mw_prototype_') && Number(item.id.at(-1)) >= 2 && options?.accuracy !== false ? 1 : 0
  if (accuracy + (auto || 0) + optics) sources.push(`attack accuracy: +${accuracy + (auto || 0) + optics}${auto ? ' (Auto-Stabilizing Hardpoints)' : ''}${optics ? ' (Tweaked Optics)' : ''}`)
  if (options?.smart !== false && item.id.startsWith('mw_prototype_') && Number(item.id.at(-1)) >= 2) tags.push({ id: 'tg_smart' })
  if (item.id.startsWith('mw_prototype_') && Number(item.id.at(-1)) >= 2 && (options?.accuracy === false || options?.smart === false)) sources.push('Stripped reactor shielding: spend 2 Heat when attacking to use the alternate area pattern (conditional).')
  if (location && sheet.core_bonuses?.includes('cb_overpower_caliber') && coreMounts.cb_overpower_caliber === location.mount * 2 + location.position)
    sources.push('Overpower Caliber: +4 bonus damage on hit, once per round (not included in base damage).')
  const deployables = Array.isArray(selected.raw?.deployables) ? selected.raw.deployables.map((raw: Record<string, unknown>) => {
    const result = { ...raw }
    for (const key of ['hp', 'evasion', 'edef', 'armor', 'speed', 'heatcap', 'size']) {
      if (typeof raw[key] !== 'number') continue
      const entries = bonuses.filter(entry => [
        `deployable_${key}`, ...(String(raw.type).toLowerCase() === 'drone' ? [`drone_${key}`] : []),
      ].includes(entry.bonus.id) && !entry.bonus.condition && !entry.bonus.detail).flatMap(entry => {
        const value = bonusValue(entry.bonus.val, variables)
        return value === null ? [] : [{ source: entry.source, value, replace: entry.bonus.replace, overwrite: entry.bonus.overwrite }]
      })
      result[key] = resolveBonuses(Number(raw[key]), entries).value
      for (const entry of entries) sources.push(`${entry.source}: ${entry.value >= 0 ? '+' : ''}${entry.value} ${raw.name ?? 'deployable'} ${key}`)
    }
    return result
  }) : []
  return { ...selected, range, damage, tags, sources, raw: { ...selected.raw, deployables } }
}
