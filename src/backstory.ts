import { ref, shallowRef, watch } from 'vue'
import type { Json } from './lib/database.types'
import { supabase } from './lib/supabaseClient'

// A pilot's backstory is private (it's in the private sheet) unless its player makes it public. A public one has a copy in
// pilot_public_backstory, which every logged-in user can read; the database keeps the copy equal to the pilot's sheet.
// "isPublic" says whether a copy exists, "copy" is what other players see, and set() makes the backstory public or
// private again (set_backstory_public: the pilot's own player, GMs and owners). It returns an error message or null.
export function useBackstoryVisibility(characterId: () => number | undefined) {
  const isPublic = ref(false)
  const copy = shallowRef<Json | null>(null)
  const loading = ref(true)

  async function load() {
    const id = characterId()
    if (id === undefined) return
    const { data } = await supabase.from('pilot_public_backstory').select('backstory').eq('character_id', id).maybeSingle()
    isPublic.value = !!data
    copy.value = data?.backstory ?? null
    loading.value = false
  }
  watch(characterId, load, { immediate: true })

  async function set(makePublic: boolean) {
    const { error } = await supabase.rpc('set_backstory_public', { target_character_id: characterId()!, make_public: makePublic })
    if (error) return error.message
    await load()
    return null
  }

  return { isPublic, copy, loading, set }
}
