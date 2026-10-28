import type { Json } from './lib/database.types'

// A named entry with a formatted description: a pilot's traits and a mech's quirks are lists of these.
// They're stored as JSON, which anyone could have written anything into through the API, so lists
// read from the database go through parseEntries(), which keeps only well-formed entries.
// (The description is cleaned separately when it's shown, by RichText.vue.)

export type Entry = { id: string; name: string; description: Json | null }

export function parseEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const { id, name, description } = item as Record<string, unknown>
    if (typeof id !== 'string' || typeof name !== 'string' || !name.trim()) return []
    return [{ id, name, description: (description ?? null) as Json | null }]
  })
}
