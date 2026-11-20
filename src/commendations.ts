import { ref, shallowRef, watch } from 'vue'
import type { Tables } from './lib/database.types'
import { checkWrite, fetchAll, supabase } from './lib/supabaseClient'

// Commendations: awards GMs give pilots. The list of commendations (name, description, icon) is the owners' content
// (the content editor's Commendations tab); an award ties one to a pilot with an optional reason. Both are public to
// every logged-in user. Awarding also writes an automatic service-record entry (a database trigger).

export type Commendation = Pick<Tables<'commendations'>, 'id' | 'name' | 'description' | 'icon' | 'updated_at'>
export type Award = {
  id: string
  reason: string
  awarded_at: string
  commendation: Pick<Commendation, 'id' | 'name' | 'description' | 'icon'>
  by: string | null // the GM's display name, if they still have a profile
}

export const REASON_MAX = 300

// The symbols an owner can pick from: fitting ones from the site's icon set (src/assets/icons).
export const ICON_CHOICES = [
  'medal', 'star', 'crown', 'shield', 'flame', 'heart', 'crosshair', 'flag',
  'dead', 'weapon', 'frame', 'hull', 'repair', 'reactor', 'talent',
  'corebonus', 'license', 'pilot', 'user', 'approved', 'map-pin', 'book-open', 'speed',
]

// The icon to draw for a stored name: itself when it's in the set, else the plain medal.
export const awardIcon = (name: string) => (ICON_CHOICES.includes(name) ? name : 'medal')

export async function loadCommendations(): Promise<{ rows: Commendation[]; error: string | null }> {
  return fetchAll((from, to) => supabase.from('commendations').select('id, name, description, icon, updated_at').order('name').order('id').range(from, to))
}

// One pilot's awards, oldest first, and the GM's writes (award, revoke). Writes return an error message, or null.
export function usePilotAwards(characterId: () => number | undefined) {
  const awards = shallowRef<Award[]>([])
  const loaded = ref(false)

  async function load() {
    const id = characterId()
    if (id === undefined) return
    const { data, error } = await supabase
      .from('pilot_commendations')
      .select('id, reason, awarded_at, commendation:commendations(id, name, description, icon), awarder:profiles(display_name)')
      .eq('character_id', id)
      .order('awarded_at')
      .order('id')
    if (error) return
    awards.value = (data ?? []).map((row) => ({ id: row.id, reason: row.reason, awarded_at: row.awarded_at, commendation: row.commendation, by: row.awarder?.display_name ?? null }))
    loaded.value = true
  }
  watch(characterId, load, { immediate: true })

  async function award(commendationId: string, reason: string) {
    const result = await checkWrite(await supabase.from('pilot_commendations').insert({ character_id: characterId()!, commendation_id: commendationId, reason: reason.trim() }).select('id'))
    if (result.row) await load()
    return result.error
  }

  async function revoke(awardId: string) {
    const result = await checkWrite(await supabase.from('pilot_commendations').delete().eq('id', awardId).select('id'))
    if (result.row) awards.value = awards.value.filter((a) => a.id !== awardId)
    return result.error
  }

  return { awards, loaded, load, award, revoke }
}
