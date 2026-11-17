import { computed, ref, watch } from 'vue'
import type { Session } from '@supabase/supabase-js'
import type { Tables } from './lib/database.types'
import { supabase } from './lib/supabaseClient'

type Profile = Pick<Tables<'profiles'>, 'display_name' | 'role'>

export const session = ref<Session | null>(null)
export const profile = ref<Profile | null>(null)
// Set when the profile couldn't be loaded (network, a paused database): App.vue says so instead of leaving pages on "Loading…".
export const profileError = ref('')
// For showing or hiding GM things on the page. The database enforces the real rules.
export const isGm = computed(() => profile.value?.role === 'gm' || profile.value?.role === 'owner')
// Owners also manage game content (the editors and the LCP importer).
export const isOwner = computed(() => profile.value?.role === 'owner')

// If a login fails (e.g. Discord was cancelled), Supabase sends the reason back in the URL.
const urlParams = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
export const loginError = urlParams.get('error_description')

// Resolves once Supabase has loaded a saved login, or the one Discord just sent back.
export const authReady = supabase.auth.getSession().then(({ data }) => {
  session.value = data.session
})

supabase.auth.onAuthStateChange((_event, newSession) => {
  session.value = newSession
})

// Loaded here rather than inside onAuthStateChange, because Supabase warns against
// making other Supabase calls inside that callback.
export async function loadProfile() {
  profile.value = null
  profileError.value = ''
  const userId = session.value?.user.id
  if (!userId) return
  const { data, error } = await supabase.from('profiles').select('display_name, role').eq('id', userId).single()
  if (error) {
    console.error('Could not load profile:', error.message)
    profileError.value = error.message
  }
  profile.value = data
}
watch(() => session.value?.user.id, loadProfile)
