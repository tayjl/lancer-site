import type { Json } from './lib/database.types'

// A named entry with a formatted description: a pilot's traits and a mech's quirks are lists of these.
// They're stored as JSON; the description is cleaned when it's shown, by RichText.vue.

export type Entry = { id: string; name: string; description: Json | null }
