import type { Bonus } from './gameData'

// Imported formulas are data, never JavaScript. Only arithmetic and known build variables are allowed.
export function bonusValue(value: unknown, variables: Record<string, number> = {}): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.length > 250) return null
  const text = value.replace(/\{([a-z_]+)\}/gi, (_, key: string) => Object.hasOwn(variables, key.toLowerCase()) ? String(variables[key.toLowerCase()]) : '?').replace(/\s/g, '')
  const tokens = text.match(/\d+(?:\.\d+)?|[()+*/%-]|[a-z]+|,/gi) ?? []
  if (tokens.join('') !== text || tokens.length > 100) return null
  let at = 0
  function atom(): number {
    const token = tokens[at++]
    if (token === '-') return -atom()
    if (token === '+') return atom()
    if (token === '(') { const result = expression(); if (tokens[at++] !== ')') throw Error(); return result }
    if (token && /^(floor|ceil|round|min|max)$/i.test(token)) {
      if (tokens[at++] !== '(') throw Error()
      const args = [expression()]
      while (tokens[at] === ',') { at++; args.push(expression()) }
      if (tokens[at++] !== ')') throw Error()
      if (['floor', 'ceil', 'round'].includes(token.toLowerCase()) && args.length !== 1) throw Error()
      const functions: Record<string, (...values: number[]) => number> = { floor: value => Math.floor(value), ceil: value => Math.ceil(value), round: value => Math.round(value), min: Math.min, max: Math.max }
      return functions[token.toLowerCase()](...args)
    }
    if (!token || !/^\d+(\.\d+)?$/.test(token)) throw Error()
    return Number(token)
  }
  function product(): number {
    let result = atom()
    while (['*', '/', '%'].includes(tokens[at])) {
      const operator = tokens[at++], next = atom()
      result = operator === '*' ? result * next : operator === '/' ? result / next : result % next
    }
    return result
  }
  function expression(): number {
    let result = product()
    while (tokens[at] === '+' || tokens[at] === '-') { const operator = tokens[at++], next = product(); result += operator === '+' ? next : -next }
    return result
  }
  try { const result = expression(); return at === tokens.length && Number.isFinite(result) ? result : null } catch { return null }
}

export type NamedBonus = { source: string; bonus: Bonus }
export function permanentBonus(bonus: Bonus) {
  return !bonus.condition && !bonus.detail && !['damage_types', 'range_types', 'weapon_types', 'weapon_sizes'].some(key => Array.isArray(bonus[key]) && (bonus[key] as unknown[]).length)
}

export function resolveBonuses(base: number, entries: { source: string; value: number; replace?: boolean; overwrite?: boolean }[]) {
  const highest = (list: typeof entries) => list.reduce<typeof entries[number] | undefined>((best, entry) => !best || entry.value > best.value ? entry : best, undefined)
  const fixed = highest(entries.filter(entry => entry.replace && entry.overwrite))
  const replacement = entries.filter(entry => entry.replace && !entry.overwrite)
  const override = highest(entries.filter(entry => entry.overwrite && !entry.replace))
  const additive = override ? [override] : entries.filter(entry => !entry.replace && !entry.overwrite)
  return {
    value: fixed ? fixed.value : (replacement.length ? replacement.reduce((sum, entry) => sum + entry.value, 0) : base) + additive.reduce((sum, entry) => sum + entry.value, 0),
    used: fixed ? [fixed] : [...replacement, ...additive],
    usesBase: !fixed && !replacement.length,
  }
}
