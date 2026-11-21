import type { Database, Json, Tables } from './lib/database.types'
import { fetchAll, supabase } from './lib/supabaseClient'

// The public parts of a character (the characters table), which every logged-in user can see.
// The GM roster and the pilot record page use this shape.
// Appearance and personality are formatted text from the editor (shown with RichText.vue); traits are a
// list of named entries (see src/entries.ts).

export type PublicMech = {
  id: string
  name: string
  manufacturer_id: string
  appearance: Json | null
  image: string | null
}

// Only what the GM roster's cards use. "player" is the owner's profile, joined in for their display name.
export type PublicPilot = Pick<Tables<'characters'>, 'id' | 'status' | 'created_at' | 'submitted_at' | 'callsign' | 'pilot_name' | 'pilot_image'> & {
  mechs: PublicMech[]
  player: { display_name: string } | null
  // The pilot's chosen colour (pilot_profiles), if they set one. It decorates their card.
  profile: { colour: string | null } | null
  // How many commendations they have: the embedded count (one row, {count}), so it comes in the same query.
  awards?: { count: number }[]
}

// Shared with the GM roster, which adds the private sheet's few columns.
export const PILOT_FIELDS = 'id, status, created_at, submitted_at, callsign, pilot_name, pilot_image, mechs, player:profiles(display_name), profile:pilot_profiles(colour), awards:pilot_commendations(count)'

// One pilot's ID card in the pilot lists (registry, pending, memorial): the pilot_cards() database function's row.
// colour is the stored colour (draw it through displayColour); medals are the commendations' icon names.
export type PilotCardRow = Database['public']['Functions']['pilot_cards']['Returns'][number]

// Every pilot with this status, oldest first. Pending means submitted: drafts aren't listed, and the oldest submission
// comes first (pilot_cards() filters; the order is repeated here, with the id to break ties, for paging).
// Returns the pilots, or an error message.
export async function fetchPilotCards(status: Tables<'characters'>['status']) {
  const { rows, error } = await fetchAll((from, to) =>
    supabase.rpc('pilot_cards', { target_status: status }).order(status === 'pending' ? 'submitted_at' : 'created_at').order('id').range(from, to),
  )
  return { pilots: rows, error: error ?? '' }
}

// The pilot lists' search: every typed word must appear in the callsign, pilot name or player name (what the card shows).
export function pilotMatches(pilot: Pick<PilotCardRow, 'callsign' | 'pilot_name' | 'player_name'>, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const text = [pilot.callsign, pilot.pilot_name, pilot.player_name].join(' ').toLowerCase()
  return words.every((word) => text.includes(word))
}
