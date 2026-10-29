import { computed, ref, shallowRef } from 'vue'
import { session } from './auth'
import { parseEntries, type Entry } from './entries'
import type { Json, Tables, TablesUpdate } from './lib/database.types'
import { supabase } from './lib/supabaseClient'
import { PUBLIC_COLUMNS } from './changeDiff'
import type { PublicMech } from './pilots'
import type { GmFields } from './rules'

// A pilot for pilot_management and the mech pages: the public card (characters table) and the private sheet
// (character_sheets). With no id it's your own pilot, editable while pending. With an id (a registry record)
// it's that pilot, read-only; the database only hands over the private sheet to its player, GMs and owners,
// and "canSeePrivate" says whether it did. Every save returns an error message, or null if it worked.
// Saves run one at a time, in order, so quick autosaves can't overtake each other and undo a newer change.

export type Character = Tables<'characters'>
// A mech's private details, kept in the sheet under its id. "frame" is a frame id; "mounts" holds the weapon
// ids on each of the frame's mounts, in the frame's order (one or two places each, null where empty);
// "systems" holds system ids.
export type MechPrivate = {
  history?: Json | null
  quirks?: Entry[]
  frame?: string
  mounts?: (string | null)[][]
  systems?: string[]
}
// The private sheet so far (docs/database-sketch.md has the full shape). Licences, talents and the rest arrive
// with the game data. Stats are keyed by id; gear holds content_items ids and bionics holds bionics ids.
export type Sheet = {
  backstory?: Json | null
  mechs?: Record<string, MechPrivate>
  pilot_stats?: Record<string, number>
  mech_skills?: Record<string, number>
  pilot_gear?: string[]
  bionics?: number[]
  // Bought with manna (src/rules.ts): the rank (1 to 3) in each licence, keyed by licence (frame) id, and in
  // each talent, keyed by talent id. Core bonuses (ids) are free, one per 3 licence ranks.
  licences?: Record<string, number>
  talents?: Record<string, number>
  core_bonuses?: string[]
}

export const MANUFACTURER_ID = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

// Checks a mech's name and manufacturer id before saving. Returns a message for the player, or null.
export function mechProblem(name: string, manufacturerId: string) {
  if (!name) return 'a mech needs a name.'
  if (!MANUFACTURER_ID.test(manufacturerId)) return 'the manufacturer id should look like XXXX-XXXX-XXXX (letters and digits).'
  return null
}

export type PendingChange = Tables<'pending_changes'>

// Your own approved pilot can't be edited directly: you propose a change (a pending_changes row holding the
// whole proposed card and sheet). While it's a draft (not submitted), the page shows it and every save goes
// into it instead of the pilot, so pilot_management and the mech pages edit it unchanged. Submitting puts it
// in the GM queue (pending_changes); until a GM reviews it you can take it back to a draft or withdraw it.
export function useMyPilot(pilotId?: number) {
  // Shallow: these are replaced as a whole on every reload, so Vue doesn't need to track inside them.
  const character = shallowRef<Character | null>(null)
  const sheet = shallowRef<Sheet>({})
  // Level (gained narratively) and manna received. They live beside the sheet, not in it, and only GMs can
  // change them (the database enforces it). See src/rules.ts for what they give.
  const gm = ref<GmFields>({ level: 0, manna: 0 })
  // A GM's note when they send a pending pilot back. Cleared when the pilot is approved.
  const reviewNote = ref('')
  const playerName = ref('')
  const canSeePrivate = ref(false)
  const loading = ref(true)
  const loadError = ref('')
  // Your approved pilot's latest change (any status), and when its sheet last changed (for "based_on").
  const change = shallowRef<PendingChange | null>(null)
  let sheetUpdatedAt = ''
  // The change being written or waiting on a GM.
  const draft = computed(() => (change.value?.status === 'pending' ? change.value : null))

  const editable = computed(
    () => !pilotId && (!character.value || character.value.status === 'pending' || (!!draft.value && !draft.value.submitted_at)),
  )
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
        .select('sheet, level, manna, review_note, updated_at')
        .eq('character_id', data.id)
        .maybeSingle()
      sheet.value = (privateRow?.sheet ?? {}) as unknown as Sheet
      gm.value = { level: privateRow?.level ?? 0, manna: privateRow?.manna ?? 0 }
      reviewNote.value = privateRow?.review_note ?? ''
      sheetUpdatedAt = privateRow?.updated_at ?? ''
      // Your own sheet may not exist yet (the first save creates it), but it's still yours to fill in.
      canSeePrivate.value = !pilotId || !!privateRow
      change.value = null
      if (!pilotId && data.status === 'approved') {
        const { data: latest } = await supabase
          .from('pending_changes')
          .select('*')
          .eq('character_id', data.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        change.value = latest
        // Show the change in progress instead of the approved pilot.
        if (latest?.status === 'pending') {
          character.value = { ...character.value!, ...(latest.proposed_public as object) }
          sheet.value = latest.proposed_sheet as unknown as Sheet
        }
      }
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

  // Saves into the draft change instead of the pilot (see above).
  const saveDraft = (fields: Pick<TablesUpdate<'pending_changes'>, 'proposed_public' | 'proposed_sheet'>) =>
    queued(async () => {
      const { data, error } = await supabase.from('pending_changes').update(fields).eq('id', draft.value!.id).select().single()
      if (data) change.value = data
      return error?.message ?? null
    })

  // Changes only the given columns, then keeps the row the database sends back.
  function updateCharacter(changes: TablesUpdate<'characters'>) {
    if (draft.value) {
      character.value = { ...character.value!, ...changes }
      return saveDraft({ proposed_public: { ...(draft.value.proposed_public as object), ...changes } as NonNullable<Json> })
    }
    return queued(async () => {
      const { data, error } = await supabase.from('characters').update(changes).eq('id', character.value!.id).select().single()
      if (data) character.value = data
      return error?.message ?? null
    })
  }

  // Merges changes into the private sheet straight away (so quick clicks build on each other), then saves it.
  // Upsert, so it also works if the sheet row was never created.
  function updateSheet(changes: Partial<Sheet>) {
    sheet.value = { ...sheet.value, ...changes }
    if (draft.value) return saveDraft({ proposed_sheet: sheet.value as unknown as NonNullable<Json> })
    return queued(async () => {
      const { error } = await supabase
        .from('character_sheets')
        .upsert({ character_id: character.value!.id, sheet: sheet.value as unknown as NonNullable<Json> })
      return error?.message ?? null
    })
  }

  // --- Changes to your approved pilot ---

  // A new draft: a copy of the pilot as it is, and when it last changed, so approving can tell if a GM has
  // edited it since (approve_change refuses then).
  const proposeChange = () =>
    queued(async () => {
      const c = character.value!
      const card = Object.fromEntries(PUBLIC_COLUMNS.map((column) => [column, c[column]]))
      const basedOn = [c.updated_at, sheetUpdatedAt].filter(Boolean).sort().at(-1)!
      const { error } = await supabase.from('pending_changes').insert({
        character_id: c.id,
        submitted_by: session.value!.user.id,
        proposed_public: card as NonNullable<Json>,
        proposed_sheet: sheet.value as unknown as NonNullable<Json>,
        based_on: basedOn,
      })
      if (!error) await load()
      return error?.message ?? null
    })

  // Submitting puts the draft in the GM queue; taking it back makes it a draft again (and leaves the queue).
  const setSubmitted = (submitted: boolean) =>
    queued(async () => {
      const { data, error } = await supabase
        .from('pending_changes')
        .update({ submitted_at: submitted ? new Date().toISOString() : null })
        .eq('id', draft.value!.id)
        .select()
        .single()
      if (data) change.value = data
      return error?.message ?? null
    })

  // Withdrawing deletes the change; the approved pilot shows again.
  const withdrawChange = () =>
    queued(async () => {
      const { error } = await supabase.from('pending_changes').delete().eq('id', draft.value!.id)
      if (!error) await load()
      return error?.message ?? null
    })

  // Marking your approved pilot dead (mark_dead in the database): it moves to the memorial for good, any
  // waiting change is withdrawn, and you can register a new pilot.
  const markDead = () =>
    queued(async () => {
      const { error } = await supabase.rpc('mark_dead', { target_character_id: character.value!.id })
      if (!error) await load()
      return error?.message ?? null
    })

  // After a GM sends the pilot back: clearing their note puts it back in the GM review queue.
  const resubmit = () =>
    queued(async () => {
      const { error } = await supabase.from('character_sheets').update({ review_note: null }).eq('character_id', character.value!.id)
      if (!error) reviewNote.value = ''
      return error?.message ?? null
    })

  // This clears only the approval message, including while a proposed edit is open.
  const dismissApprovalNote = () =>
    queued(async () => {
      const { error } = await supabase.rpc('dismiss_approval_note', {
        target_character_id: character.value!.id,
        expected_note: reviewNote.value,
      })
      if (!error) reviewNote.value = ''
      return error?.message ?? null
    })

  load()

  return {
    character,
    sheet,
    gm,
    reviewNote,
    playerName,
    canSeePrivate,
    loading,
    loadError,
    editable,
    mechs,
    traits,
    change,
    draft,
    load,
    create,
    updateCharacter,
    updateSheet,
    resubmit,
    dismissApprovalNote,
    proposeChange,
    submitChange: () => setSubmitted(true),
    reopenChange: () => setSubmitted(false),
    withdrawChange,
    markDead,
  }
}
