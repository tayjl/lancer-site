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

// "player" is the owner's profile, joined in for their display name.
export type PublicPilot = Omit<Tables<'characters'>, 'mechs'> & {
  mechs: PublicMech[]
  player: { display_name: string } | null
}

const PILOT_FIELDS = '*, player:profiles(display_name)'

// The mechs column is plain JSON to the database; the site always saves it in the PublicMech shape.
const toPilot = (row: object) => {
  const pilot = row as unknown as PublicPilot
  return { ...pilot, mechs: Array.isArray(pilot.mechs) ? pilot.mechs : [] }
}

// Every pilot with this status, oldest first. Returns the pilots, or an error message.
export async function fetchPilots(status: Tables<'characters'>['status']) {
  const { data, error } = await supabase.from('characters').select(PILOT_FIELDS).eq('status', status).order('created_at')
  return { pilots: (data ?? []).map(toPilot), error: error?.message ?? '' }
}

export async function fetchPilot(id: number) {
  const { data, error } = await supabase.from('characters').select(PILOT_FIELDS).eq('id', id).maybeSingle()
  return { pilot: data ? toPilot(data) : null, error: error?.message ?? '' }
}
