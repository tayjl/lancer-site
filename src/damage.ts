// Average ordinary dice sums without evaluating imported content as JavaScript.
export function averageDamage(value: string | number): string | number {
  if (typeof value === 'number') return Math.ceil(value)
  const expression = value.replace(/\s/g, '')
  if (!/^[+-]?(?:\d*d[1-9]\d*|\d+(?:\.\d+)?)(?:[+-](?:\d*d[1-9]\d*|\d+(?:\.\d+)?))*$/i.test(expression)) return value
  return Math.ceil((expression.match(/[+-]?[^+-]+/g) ?? []).reduce((sum, term) => {
    const dice = term.match(/^([+-]?)(\d*)d(\d+)$/i)
    return sum + (dice ? (dice[1] === '-' ? -1 : 1) * Number(dice[2] || 1) * (Number(dice[3]) + 1) / 2 : Number(term))
  }, 0))
}

// shortcut: only explicit damage phrases are converted; unusual prose needs a content-specific rule.
// Rules are displayed as plain text. Strip markup before matching, including markup between dice and type.
export function averageDamageText(text: string): string {
  return text.replace(/<[^>]*>/g, ' ').replace(
    /\b\d*d\d+(?:\s*[+-]\s*(?:\d+d\d+|\d+))*(?=\s+(?:(?:AP|kinetic|energy|explosive|burn|heat|bonus)\s+)*damage\b|\s+(?:AP\s+)?(?:kinetic|energy|explosive|burn)\b)/gi,
    dice => String(averageDamage(dice)),
  )
}
