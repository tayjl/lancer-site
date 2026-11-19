// "1 pilot", "3 pilots", "2 entries": the count and its noun, with the noun made plural in code.
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
