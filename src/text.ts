// "1 pilot", "3 pilots", "2 entries": the count and its noun, with the noun made plural in code.
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// Same name, whatever the capitals and spaces around it.
export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
