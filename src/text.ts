// "1 pilot", "3 pilots", "2 entries": the count and its noun, with the noun made plural in code.
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// "½, 1, 2 or 3".
export const orList = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}` : items.join(''))

// Same name, whatever the capitals and spaces around it.
export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
