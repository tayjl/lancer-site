import { computed, ref, shallowRef } from 'vue'
import { session } from './auth'
import { parseEntries, type Entry } from './entries'
import type { Json, Tables, TablesUpdate } from './lib/database.types'
import { supabase } from './lib/supabaseClient'
import type { PublicMech } from './pilots'

// Your own pilot, for pilot_management and the mech pages: the public card (characters table) and the
// private sheet (character_sheets). Every save returns an error message, or null if it worked.
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

export function useMyPilot() {
  // Shallow: these are replaced as a whole on every reload, so Vue doesn't need to track inside them.
  const character = shallowRef<Character | null>(null)
  const sheet = shallowRef<Sheet>({})
  // The mod limit. Lives beside the sheet, not in it, so after approval only GMs can change it.
  const modPoints = ref(6)
  const loading = ref(true)
  const loadError = ref('')

  const editable = computed(() => !character.value || character.value.status === 'pending')
  // The mechs column is plain JSON to the database; we always save it in the PublicMech shape.
  const mechs = computed(() => {
    const list = character.value?.mechs
    return (Array.isArray(list) ? list : []) as unknown as PublicMech[]
  })
  const traits = computed(() => parseEntries(character.value?.traits))

  async function load() {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('player_id', session.value!.user.id)
      .in('status', ['pending', 'approved'])
      .order('created_at')
      .limit(1)
      .maybeSingle()
    loadError.value = error?.message ?? ''
    character.value = data
    if (data) {
      const { data: row } = await supabase
        .from('character_sheets')
        .select('sheet, mod_points')
        .eq('character_id', data.id)
        .maybeSingle()
      sheet.value = (row?.sheet ?? {}) as unknown as Sheet
      modPoints.value = row?.mod_points ?? 6
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

  load()

  return { character, sheet, modPoints, loading, loadError, editable, mechs, traits, load, create, updateCharacter, updateSheet }
}
