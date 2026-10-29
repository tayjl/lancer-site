import { computed, ref, shallowRef } from 'vue'
import { session } from './auth'
import { parseEntries, type Entry } from './entries'
import type { Json, Tables, TablesUpdate } from './lib/database.types'
import { supabase } from './lib/supabaseClient'
import type { PublicMech } from './pilots'

// A pilot for pilot_management and the mech pages: the public card (characters table) and the private sheet
// (character_sheets). With no id it's your own pilot, editable while pending. With an id (a registry record)
// it's that pilot, read-only; the database only hands over the private sheet to its player, GMs and owners,
// and "canSeePrivate" says whether it did. Every save returns an error message, or null if it worked.
// Saves run one at a time, in order, so quick autosaves can't overtake each other and undo a newer change.

export type Character = Tables<'characters'>
// A mech's private details, kept in the sheet under its id. Frames and loadouts join these later.
export type MechPrivate = { history?: Json | null; quirks?: Entry[] }
// The private sheet so far (docs/database-sketch.md has the full shape). Licences, talents and the rest arrive
// with the game data. Stats are keyed by id; gear holds content_items ids and bionics holds bionics ids.
export type Sheet = {
  backstory?: Json | null
  mechs?: Record<string, MechPrivate>
  pilot_stats?: Record<string, number>
  mech_skills?: Record<string, number>
  pilot_gear?: string[]
  bionics?: number[]
}

export const MANUFACTURER_ID = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

// Checks a mech's name and manufacturer id before saving. Returns a message for the player, or null.
export function mechProblem(name: string, manufacturerId: string) {
  if (!name) return 'a mech needs a name.'
  if (!MANUFACTURER_ID.test(manufacturerId)) return 'the manufacturer id should look like XXXX-XXXX-XXXX (letters and digits).'
  return null
}

export function useMyPilot(pilotId?: number) {
  // Shallow: these are replaced as a whole on every reload, so Vue doesn't need to track inside them.
  const character = shallowRef<Character | null>(null)
  const sheet = shallowRef<Sheet>({})
  // The mod limit. Lives beside the sheet, not in it, so after approval only GMs can change it.
  const modPoints = ref(6)
  // A GM's note when they send a pending pilot back. Cleared when the pilot is approved.
  const reviewNote = ref('')
  const playerName = ref('')
  const canSeePrivate = ref(false)
  const loading = ref(true)
  const loadError = ref('')

  const editable = computed(() => !pilotId && (!character.value || character.value.status === 'pending'))
  // The mechs column is plain JSON to the database; we always save it in the PublicMech shape.
  const mechs = computed(() => {
    const list = character.value?.mechs
    return (Array.isArray(list) ? list : []) as unknown as PublicMech[]
  })
  const traits = computed(() => parseEntries(character.value?.traits))

  async function load() {
    const query = supabase.from('characters').select('*, player:profiles(display_name)')
    const { data, error } = await (pilotId
      ? query.eq('id', pilotId)
      : query.eq('player_id', session.value!.user.id).in('status', ['pending', 'approved']).order('created_at').limit(1)
    ).maybeSingle()
    loadError.value = error?.message ?? ''
    const { player, ...row } = data ?? { player: null }
    character.value = data ? (row as Character) : null
    playerName.value = player?.display_name ?? ''
    if (data) {
      const { data: privateRow } = await supabase
        .from('character_sheets')
        .select('sheet, mod_points, review_note')
        .eq('character_id', data.id)
        .maybeSingle()
      sheet.value = (privateRow?.sheet ?? {}) as unknown as Sheet
      modPoints.value = privateRow?.mod_points ?? 6
      reviewNote.value = privateRow?.review_note ?? ''
      // Your own sheet may not exist yet (the first save creates it), but it's still yours to fill in.
      canSeePrivate.value = !pilotId || !!privateRow
    }
    loading.value = false
  }

  // First save of the identity: creates the pending pilot, then its empty private sheet.
  async function create(fields: { pilot_name: string } & TablesUpdate<'characters'>) {
    const { data, error } = await supabase
      .from('characters')
      .insert({ ...fields, player_id: session.value!.user.id })
      .select('id')
      .single()
    if (error) return error.message
    const { error: sheetError } = await supabase.from('character_sheets').insert({ character_id: data.id, sheet: {} })
    await load()
    return sheetError?.message ?? null
  }

  let queue: Promise<unknown> = Promise.resolve()
  // Runs a save after the ones before it. On failure it reloads, so the page shows what's really saved.
  function queued(save: () => Promise<string | null>) {
    const result = queue.then(save).then(async (error) => {
      if (error) await load()
      return error
    })
    queue = result
    return result
  }

  // Changes only the given columns, then keeps the row the database sends back.
  const updateCharacter = (changes: TablesUpdate<'characters'>) =>
    queued(async () => {
      const { data, error } = await supabase.from('characters').update(changes).eq('id', character.value!.id).select().single()
      if (data) character.value = data
      return error?.message ?? null
    })

  // Merges changes into the private sheet straight away (so quick clicks build on each other), then saves it.
  // Upsert, so it also works if the sheet row was never created.
  function updateSheet(changes: Partial<Sheet>) {
    sheet.value = { ...sheet.value, ...changes }
    return queued(async () => {
      const { error } = await supabase
        .from('character_sheets')
        .upsert({ character_id: character.value!.id, sheet: sheet.value as unknown as NonNullable<Json> })
      return error?.message ?? null
    })
  }

  // After a GM sends the pilot back: clearing their note puts it back in the GM review queue.
  const resubmit = () =>
    queued(async () => {
      const { error } = await supabase.from('character_sheets').update({ review_note: null }).eq('character_id', character.value!.id)
      if (!error) reviewNote.value = ''
      return error?.message ?? null
    })

  load()

  return { character, sheet, modPoints, reviewNote, playerName, canSeePrivate, loading, loadError, editable, mechs, traits, load, create, updateCharacter, updateSheet, resubmit }
}
