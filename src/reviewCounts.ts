import { ref } from 'vue'
import { supabase } from './lib/supabaseClient'

// How many pilots and changes wait for a GM (the top bar's count chips). Same filters as the GM queues.
export const waitingPilots = ref(0)
export const waitingChanges = ref(0)

export async function loadReviewCounts() {
  const [pilots, changes] = await Promise.all([
    supabase.from('characters').select('id', { count: 'exact', head: true }).eq('status', 'pending').not('submitted_at', 'is', null),
    supabase.from('pending_changes').select('id', { count: 'exact', head: true }).eq('status', 'pending').not('submitted_at', 'is', null),
  ])
  // A failed count keeps the last number rather than flashing 0.
  if (pilots.count !== null) waitingPilots.value = pilots.count
  if (changes.count !== null) waitingChanges.value = changes.count
}
