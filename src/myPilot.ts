import { computed, ref, shallowRef, watch } from 'vue'
import { isGm, session } from './auth'
import type { Entry } from './entries'
import type { Json, Tables, TablesUpdate } from './lib/database.types'
import { cardImages, deleteImage } from './images'
import { CHANGED_ELSEWHERE, checkWrite, supabase } from './lib/supabaseClient'
import { PUBLIC_COLUMNS } from './changeDiff'
import { NOT_SUBMITTED } from './saveStatus'
import type { PublicMech } from './pilots'
import { STARTING_MANNA, type GmFields } from './rules'

// A pilot for pilot_management and the mech pages: the public card (characters table) and the private sheet
// (character_sheets). With no id it's your own pilot, editable while pending. With an id (a registry record)
// it's that pilot, read-only; the database only hands over the private sheet to its player, GMs and owners,
// and "canSeePrivate" says whether it did. Every save returns an error message, or null if it worked.
// Saves run one at a time, in order, and each sends the whole card or sheet as it is on screen when it runs, so a quick
// second edit can't undo the first. A failed save keeps the edit on screen (and "retry" sends it again); a save refused
// because the row was saved somewhere else sets "conflict" and stops all further saves (guarded by updated_at).
// With an id and options.gmEdit on (a GM's edit mode, from the url), a GM or owner edits that living pilot directly:
// the same editable page and the same save path as a pending pilot of your own, with no approval.

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
  core_mounts?: Record<string, number>
  // The mod on each weapon, by the weapon's place ("mount:place", like weapon_options): a mod id.
  weapon_mods?: Record<string, string>
  weapon_options?: Record<string, { profile?: number; type?: string; damageType?: string; accuracy?: boolean; smart?: boolean }>
}
// The private sheet (docs/database-sketch.md has the full shape). Stats are keyed by id; gear holds content_items ids
// and bionics holds bionics ids.
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
  // Which frame each licence gives when it has alternate frames (Worldkiller is an alternate Genghis): licence id to the
  // chosen frame id. Unset means the original frame. Free: no manna.
  frame_choices?: Record<string, string>
  talents?: Record<string, number>
  core_bonuses?: string[]
}

export const MANUFACTURER_ID = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

// Checks a mech's name and manufacturer id before saving. Returns a message for the player, or null.
export function mechProblem(name: string, manufacturerId: string) {
  if (!name) return 'A mech needs a name.'
  if (!MANUFACTURER_ID.test(manufacturerId)) return 'The manufacturer ID should look like XXXX-XXXX-XXXX.'
  return null
}

export type PendingChange = Tables<'pending_changes'>
// A change as this page tracks it: everything but the proposed card and sheet, which are only read once, when a draft opens.
export type ChangeRow = Omit<PendingChange, 'proposed_public' | 'proposed_sheet'>
const CHANGE_FIELDS = 'id, character_id, status, submitted_by, submitted_at, based_on, created_at, updated_at, reviewed_at, reviewed_by, review_reason'

// Your own approved pilot can't be edited directly: you propose a change (a pending_changes row holding the
// whole proposed card and sheet). While it's a draft (not submitted), the page shows it and every save goes
// into it instead of the pilot, so pilot_management and the mech pages edit it unchanged. Submitting puts it
// in the GM queue (pending_changes); until a GM reviews it you can take it back to a draft or withdraw it.
export function useMyPilot(pilotId?: number, options: { gmEdit?: () => boolean } = {}) {
  // Shallow: these are replaced as a whole on every reload, so Vue doesn't need to track inside them.
  const character = shallowRef<Character | null>(null)
  const sheet = shallowRef<Sheet>({})
  // Level (gained narratively) and manna received. They live beside the sheet, not in it, and only GMs can
  // change them (the database enforces it). See src/rules.ts for what they give.
  const gm = ref<GmFields>({ level: 0, manna: STARTING_MANNA })
  // A GM's note when they send a pilot back (it's a draft again). Cleared when it's submitted again.
  const reviewNote = ref('')
  const playerName = ref('')
  const canSeePrivate = ref(false)
  const loading = ref(true)
  const loadError = ref('')
  // Your approved pilot's latest change (any status).
  const change = shallowRef<ChangeRow | null>(null)
  // When the sheet last changed, as loaded with the page (the raw string): with the card's updated_at it says what
  // this page is showing, for "based_on" below and for a GM's approve_pilot.
  const sheetUpdatedAt = ref('')
  // The change being written or waiting on a GM. "draft" is only ever your own (it redirects your saves); a GM in
  // edit mode sees "waiting" instead, to warn that editing directly stops the change from being approved.
  const waiting = computed(() => (change.value?.status === 'pending' ? change.value : null))
  const draft = computed(() => (pilotId ? null : waiting.value))
  // A GM's edit mode (on a record, by id; a GM or owner's own pilot too, through their own record): never for players or
  // dead pilots (they can't change).
  const gmEditing = computed(() => !!pilotId && !!options.gmEdit?.() && isGm.value && !!character.value && character.value.status !== 'dead')

  const editable = computed(
    () =>
      gmEditing.value ||
      (!pilotId && (!character.value || (character.value.status === 'pending' && !character.value.submitted_at) || (!!draft.value && !draft.value.submitted_at))),
  )
  // The mechs column is plain JSON to the database; we always save it in the PublicMech shape.
  const mechs = computed(() => {
    const list = character.value?.mechs
    return (Array.isArray(list) ? list : []) as unknown as PublicMech[]
  })

  async function latestChange(characterId: number) {
    const { data } = await supabase
      .from('pending_changes')
      .select(CHANGE_FIELDS)
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data
  }

  // Uploaded images are cleaned up from here, best effort: "savedImages" are the ones in the card as last loaded or
  // saved, "approvedImages" the approved pilot's (while a draft change is open, which the page shows instead).
  // A file is deleted once the card stops using it and nothing approved does.
  // shortcut: a sent-back change's rejected history row keeps its images until its draft is withdrawn or approved; add an owner clean-up if storage fills.
  let savedImages = new Set<string>()
  let approvedImages = new Set<string>()
  function dropImages(paths: Iterable<string>) {
    for (const path of paths) if (!approvedImages.has(path)) deleteImage(path)
  }

  async function load() {
    conflict.value = false
    unsaved.clear()
    const query = supabase.from('characters').select('*, player:profiles(display_name), sheet:character_sheets(sheet, level, manna, review_note, updated_at)')
    const { data, error } = await (pilotId
      ? query.eq('id', pilotId)
      : query.eq('player_id', session.value!.user.id).in('status', ['pending', 'approved']).order('created_at').limit(1)
    ).maybeSingle()
    loadError.value = error?.message ?? ''
    const { player, sheet: privateRow, ...row } = data ?? { player: null, sheet: null }
    character.value = data ? (row as Character) : null
    playerName.value = player?.display_name ?? ''
    if (data) {
      sheet.value = (privateRow?.sheet ?? {}) as unknown as Sheet
      gm.value = { level: privateRow?.level ?? 0, manna: privateRow?.manna ?? 0 }
      reviewNote.value = privateRow?.review_note ?? ''
      sheetUpdatedAt.value = privateRow?.updated_at ?? ''
      // Your own sheet may not exist yet (the first save creates it), but it's still yours to fill in.
      canSeePrivate.value = !pilotId || !!privateRow
      change.value = null
      approvedImages = new Set()
      if (data.status === 'approved' && (!pilotId || gmEditing.value)) {
        const latest = await latestChange(data.id)
        change.value = latest
        // Show the change in progress instead of the approved pilot (your own only).
        const proposed = !pilotId && latest?.status === 'pending'
          ? (await supabase.from('pending_changes').select('proposed_public, proposed_sheet').eq('id', latest.id).maybeSingle()).data
          : null
        if (proposed) {
          approvedImages = cardImages(character.value!)
          character.value = { ...character.value!, ...(proposed.proposed_public as object) }
          sheet.value = proposed.proposed_sheet as unknown as Sheet
        }
      }
      savedImages = cardImages(character.value!)
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
  // Runs an action after the saves before it.
  function queued(save: () => Promise<string | null>) {
    const result = queue.then(save)
    queue = result
    return result
  }

  // What's been edited on screen but isn't in the database yet: the card, the sheet, or (in a draft) the draft.
  type Kind = 'card' | 'sheet' | 'draft'
  const unsaved = new Set<Kind>()
  // Set when a save found the row had been saved somewhere else (another tab, a GM): the page shows a notice.
  const conflict = ref(false)
  const unsavedError = () => (unsaved.size ? 'Your last edit is not saved yet. Retry it first.' : null)

  // The card as it is now (only the public columns, which is all a draft holds).
  const card = () => Object.fromEntries(PUBLIC_COLUMNS.map((column) => [column, character.value![column]])) as NonNullable<Json>

  // The card with these images was just saved: files it no longer uses can go.
  function swapImages(now: Set<string>) {
    dropImages([...savedImages].filter((path) => !now.has(path)))
    savedImages = now
  }

  async function write(kind: Kind) {
    const c = character.value!
    const images = cardImages(c)
    if (kind === 'draft') {
      const seen = draft.value!.updated_at
      const result = await checkWrite(
        await supabase
          .from('pending_changes')
          .update({ proposed_public: card(), proposed_sheet: sheet.value as unknown as NonNullable<Json> })
          .eq('id', draft.value!.id)
          .eq('updated_at', seen)
          .select(CHANGE_FIELDS),
        { seen, recheck: () => supabase.from('pending_changes').select('updated_at').eq('id', draft.value!.id).maybeSingle() },
      )
      if (result.row) change.value = result.row
      if (!result.error) swapImages(images)
      return result.error
    }
    if (kind === 'card') {
      const result = await checkWrite(
        await supabase.from('characters').update(card() as TablesUpdate<'characters'>).eq('id', c.id).eq('updated_at', c.updated_at).select('updated_at'),
        { seen: c.updated_at, recheck: () => supabase.from('characters').select('updated_at').eq('id', c.id).maybeSingle() },
      )
      // Only the new updated_at: the card on screen may have newer edits that are still waiting their turn.
      if (result.row) character.value = { ...character.value!, updated_at: result.row.updated_at }
      if (!result.error) swapImages(images)
      return result.error
    }
    // The first save of a sheet creates it; after that it's an update, guarded by when this page last saw it.
    const body = sheet.value as unknown as NonNullable<Json>
    const seen = sheetUpdatedAt.value
    const result = seen
      ? await checkWrite(await supabase.from('character_sheets').update({ sheet: body }).eq('character_id', c.id).eq('updated_at', seen).select('updated_at'), {
          seen,
          recheck: () => supabase.from('character_sheets').select('updated_at').eq('character_id', c.id).maybeSingle(),
        })
      : await checkWrite(await supabase.from('character_sheets').upsert({ character_id: c.id, sheet: body }).select('updated_at'))
    // Keeps "what this page is showing" current, so a GM approving after editing isn't refused as stale.
    if (result.row) sheetUpdatedAt.value = result.row.updated_at
    return result.error
  }

  // Queues a save of the card, sheet or draft. It sends what's on screen when its turn comes, and skips itself if an
  // earlier save already sent it. A failure keeps the edit marked unsaved, for retry().
  function save(kind: Kind) {
    unsaved.add(kind)
    return queued(async () => {
      if (conflict.value) return CHANGED_ELSEWHERE
      if (!unsaved.delete(kind)) return null
      const error = await write(kind)
      if (error) unsaved.add(kind)
      if (error === CHANGED_ELSEWHERE) conflict.value = true
      return error
    })
  }
  // Sends everything still unsaved again.
  const retry = async () => (await Promise.all([...unsaved].map(save))).find(Boolean) ?? null

  // Changes only the given card columns, on screen straight away (so quick edits build on each other), then saves.
  function updateCharacter(changes: TablesUpdate<'characters'>) {
    character.value = { ...character.value!, ...changes }
    return save(draft.value ? 'draft' : 'card')
  }

  // Merges changes into the private sheet straight away, then saves it.
  function updateSheet(changes: Partial<Sheet>) {
    sheet.value = { ...sheet.value, ...changes }
    return save(draft.value ? 'draft' : 'sheet')
  }

  // --- Changes to your approved pilot ---

  // A new draft: a copy of the pilot as this page loaded it, and when it last changed then (based_on), so approving
  // can tell if a GM has edited it since (approve_change refuses then). The strings are sent as they came (a Date
  // would drop the microseconds); Date.parse only picks the later one. The database clamps a value later than the
  // pilot's real last change.
  const proposeChange = () =>
    queued(async () => {
      const c = character.value!
      const card = Object.fromEntries(PUBLIC_COLUMNS.map((column) => [column, c[column]]))
      const basedOn = [c.updated_at, sheetUpdatedAt.value].reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
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

  // Submitting puts the draft in the GM queue; taking it back makes it a draft again (and leaves the queue). It won't
  // send a draft whose latest edits didn't save.
  const setSubmitted = (submitted: boolean) =>
    queued(async () => {
      if (submitted && unsaved.size) return unsavedError()
      const seen = draft.value!.updated_at
      const result = await checkWrite(
        await supabase
          .from('pending_changes')
          .update({ submitted_at: submitted ? new Date().toISOString() : null })
          .eq('id', draft.value!.id)
          .eq('updated_at', seen)
          .select(CHANGE_FIELDS),
        { seen, recheck: () => supabase.from('pending_changes').select('updated_at').eq('id', draft.value!.id).maybeSingle() },
      )
      if (result.row) change.value = result.row
      if (result.error === CHANGED_ELSEWHERE) conflict.value = true
      return submitted && result.error ? NOT_SUBMITTED + result.error : result.error
    })

  // Withdrawing deletes the change; the approved pilot shows again.
  const withdrawChange = () =>
    queued(async () => {
      const { error } = await checkWrite(await supabase.from('pending_changes').delete().eq('id', draft.value!.id).select('id'))
      if (!error) {
        dropImages([...savedImages, ...cardImages(character.value!)])
        await load()
      }
      return error
    })

  // Marking your approved pilot dead (mark_dead in the database): it moves to the memorial for good, any
  // waiting change is withdrawn, and you can register a new pilot.
  const markDead = () =>
    queued(async () => {
      const { error } = await supabase.rpc('mark_dead', { target_character_id: character.value!.id })
      if (!error) await load()
      return error?.message ?? null
    })

  // A new pilot is a draft until you submit it (the GM queue and the Pending tab only list submitted pilots). Taking
  // it back makes it a draft again. The database stamps the time and clears a GM's sent-back note. It won't submit a
  // pilot whose latest edits didn't save.
  const setPilotSubmitted = (submitted: boolean) =>
    queued(async () => {
      if (submitted && unsaved.size) return unsavedError()
      const c = character.value!
      const result = await checkWrite(
        await supabase
          .from('characters')
          .update({ submitted_at: submitted ? new Date().toISOString() : null })
          .eq('id', c.id)
          .eq('updated_at', c.updated_at)
          .select('updated_at, submitted_at'),
        { seen: c.updated_at, recheck: () => supabase.from('characters').select('updated_at').eq('id', c.id).maybeSingle() },
      )
      if (result.row) character.value = { ...character.value!, ...result.row }
      if (result.row && submitted) reviewNote.value = ''
      if (result.error === CHANGED_ELSEWHERE) conflict.value = true
      return submitted && result.error ? NOT_SUBMITTED + result.error : result.error
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
  // Entering edit mode on a record (or the profile arriving late): is the player's change open?
  watch(gmEditing, async (on) => {
    if (on) change.value = character.value!.status === 'approved' ? await latestChange(character.value!.id) : null
  })

  return {
    character,
    sheet,
    gm,
    reviewNote,
    sheetUpdatedAt,
    playerName,
    canSeePrivate,
    loading,
    loadError,
    conflict,
    retry,
    editable,
    gmEditing,
    waiting,
    mechs,
    change,
    draft,
    load,
    create,
    updateCharacter,
    updateSheet,
    submitPilot: () => setPilotSubmitted(true),
    reopenPilot: () => setPilotSubmitted(false),
    dismissApprovalNote,
    proposeChange,
    submitChange: () => setSubmitted(true),
    reopenChange: () => setSubmitted(false),
    withdrawChange,
    markDead,
  }
}
