import { ref, shallowRef, watch } from 'vue'
import type { Json } from './lib/database.types'
import { readError, supabase } from './lib/supabaseClient'

// A pilot's backstory is private (it's in the private sheet) unless its player makes it public. A public one has a copy in
// pilot_public_backstory, which every logged-in user can read; the database keeps the copy equal to the pilot's sheet.
// "isPublic" says whether a copy exists, "copy" is what other players see, and set() makes the backstory public or
// private again (set_backstory_public: the pilot's own player, GMs and owners). It returns an error message or null.
export function useBackstoryVisibility(characterId: () => number | undefined) {
  const isPublic = ref(false)
  const copy = shallowRef<Json | null>(null)
  const loading = ref(true)
  const error = ref('')

  async function load() {
    const id = characterId()
    if (id === undefined) return
    const read = await supabase.from('pilot_public_backstory').select('backstory').eq('character_id', id).maybeSingle()
    // A failed read is not "private": the toggle would show the wrong state.
    error.value = read.error ? readError(read.error.message) : ''
    if (!read.error) {
      isPublic.value = !!read.data
      copy.value = read.data?.backstory ?? null
    }
    loading.value = false
  }
  watch(characterId, load, { immediate: true })

  async function set(makePublic: boolean) {
    const id = characterId()
    if (id === undefined) return 'Pilot not found.'
    const { error } = await supabase.rpc('set_backstory_public', { target_character_id: id, make_public: makePublic })
    if (error) return readError(error.message)
    await load()
    return null
  }

  return { isPublic, copy, loading, error, set }
}
