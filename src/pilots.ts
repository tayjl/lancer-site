import type { Json, Tables } from './lib/database.types'
import { supabase } from './lib/supabaseClient'

// The public parts of a character (the characters table), which every logged-in user can see.
// The registry cards and the pilot record page both use this shape.
// Appearance and personality are formatted text from the editor (shown with RichText.vue); traits are a
// list of named entries (see src/entries.ts).

export type PublicMech = {
  id: string
  name: string
  manufacturer_id: string
  appearance: Json | null
  image: string | null
}

// Only what the cards and the list search use. "player" is the owner's profile, joined in for their display name.
export type PublicPilot = Pick<Tables<'characters'>, 'id' | 'status' | 'created_at' | 'submitted_at' | 'callsign' | 'pilot_name' | 'pilot_image'> & {
  mechs: PublicMech[]
  player: { display_name: string } | null
}

// Shared with the GM roster, which adds the private sheet's few columns.
export const PILOT_FIELDS = 'id, status, created_at, submitted_at, callsign, pilot_name, pilot_image, mechs, player:profiles(display_name)'

// The mechs column is plain JSON to the database; the site always saves it in the PublicMech shape.
const toPilot = (row: object) => {
  const pilot = row as unknown as PublicPilot
  return { ...pilot, mechs: Array.isArray(pilot.mechs) ? pilot.mechs : [] }
}

// Every pilot with this status, oldest first. Pending means submitted: drafts aren't listed, and the oldest submission
// comes first. Returns the pilots, or an error message.
export async function fetchPilots(status: Tables<'characters'>['status']) {
  const query = supabase.from('characters').select(PILOT_FIELDS).eq('status', status)
  const { data, error } = await (status === 'pending' ? query.not('submitted_at', 'is', null).order('submitted_at') : query.order('created_at'))
  return { pilots: (data ?? []).map(toPilot), error: error?.message ?? '' }
}

// The pilot lists' search: every typed word must appear in the callsign, pilot name, player name or a mech name.
export function pilotMatches(pilot: PublicPilot, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const text = [pilot.callsign, pilot.pilot_name, pilot.player?.display_name, ...pilot.mechs.map((mech) => mech.name)].join(' ').toLowerCase()
  return words.every((word) => text.includes(word))
}
