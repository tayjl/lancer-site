import { computed, ref, shallowRef, watch } from 'vue'
import { isGm, session } from './auth'
import type { Entry } from './entries'
import type { Json, Tables, TablesUpdate } from './lib/database.types'
import { cardImages, deleteImage } from './images'
import { CHANGED_ELSEWHERE, checkWrite, readError, recheckUpdatedAt, supabase } from './lib/supabaseClient'
import { PUBLIC_COLUMNS } from './changeDiff'
import { NOT_SUBMITTED } from './saveStatus'
import type { PublicMech } from './pilots'
import { adjustGrants, startingManna, type GmFields, type Grants } from './rules'

// The pilot or change an action needed is gone (deleted or reloaded while it waited).
const NOT_LOADED = 'Pilot not found.'

// A pilot for pilot_management and the mech pages: the public card (characters table) and the private sheet
// (character_sheets). With no id it's your own pilot, editable while pending. With an id (a registry record)
// it's that pilot, read-only. Everything on the sheet is public except the backstory, manna and the GM's review note: the
// database hands over the whole row to the pilot's player, GMs and owners, and everyone else gets the sheet without
// them (and level) through pilot_sheet(); "canSeeBackstory" (also "canSeeManna") says whether it was the whole row. Every save returns an error message, or null if it worked.
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
  // A weapon's choices, by its place ("mount:place", or "integrated:<id>"); "notes" is its player's description.
  weapon_options?: Record<string, { profile?: number; type?: string; damageType?: string; accuracy?: boolean; smart?: boolean; notes?: string }>
  // Each system's description by its player, by its index in "systems".
  system_notes?: Record<string, string>
}
// The private sheet (docs/database-sketch.md has the full shape). Stats are keyed by id; gear holds content_items ids
// and bionics holds bionics ids.
export type OwnedGear = { key: string; id: string; notes?: string; damageType?: string; free?: boolean }
export type MiscItem = { key: string; name: string; notes?: string }
export type Sheet = {
  backstory?: Json | null
  mechs?: Record<string, MechPrivate>
  pilot_stats?: Record<string, number>
  mech_skills?: Record<string, number>
  // Pilot gear the pilot has bought (content_items ids), one entry per copy; "key" is that copy's own id. "notes" is its
  // player's description. "free" is set by the database (the starting loadout), never by the page.
  owned_gear?: OwnedGear[]
  // The owned keys currently equipped. An approved pilot's changes through equip_pilot_gear, not a change.
  equipped_gear?: string[]
  // Free-text items a GM gives the pilot (name, optional description; never equipped). GM only: the database refuses player changes.
  misc_items?: MiscItem[]
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

const MANUFACTURER_ID = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

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
  const gm = ref<GmFields>({ level: 0, manna: startingManna() })
  // What a GM gave this pilot free (rules.ts Grants). Recorded by GM edit mode, saved with the sheet; never in the sheet itself.
  const grants = ref<Grants>({})
  // A GM's note when they send a pilot back (it's a draft again). Cleared when it's submitted again.
  const reviewNote = ref('')
  const playerName = ref('')
  // The backstory, manna and the review note are in the row you can read (your own pilot, or you're a GM): other players get
  // the rest of the sheet, without them.
  const canSeeBackstory = ref(false)
  const loading = ref(true)
  const loadError = ref('')
  // Your approved pilot's latest change (any status).
  const change = shallowRef<ChangeRow | null>(null)
  // When the sheet last changed, as loaded with the page (the raw string): with the card's updated_at it says what
  // this page is showing, for "based_on" below and for a GM's approve_pilot.
  const sheetUpdatedAt = ref('')
  // While a draft change is shown instead of the pilot, the approved card and sheet as loaded (null otherwise): the pilot ID card
  // shows the approved pilot, never an open draft.
  const approved = shallowRef<{ character: Character; sheet: Sheet } | null>(null)
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

  // A failed read is shown as loadError, which replaces the page: a hidden open change would let saves overwrite it.
  async function latestChange(characterId: number) {
    const { data, error } = await supabase
      .from('pending_changes')
      .select(CHANGE_FIELDS)
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) loadError.value = readError(error.message)
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
    const query = supabase.from('characters').select('*, player:profiles(display_name), sheet:character_sheets(sheet, level, manna, gm_grants, review_note, updated_at)')
    const { data, error } = await (pilotId
      ? query.eq('id', pilotId)
      : query.eq('player_id', session.value!.user.id).in('status', ['pending', 'approved']).order('created_at').limit(1)
    ).maybeSingle()
    loadError.value = error ? readError(error.message) : ''
    const { player, sheet: fullRow, ...row } = data ?? { player: null, sheet: null }
    // Someone else's pilot: the sheet without the backstory, manna and notes (pilot_sheet, public to every logged-in user).
    let privateRow: { sheet: Json; level: number; manna?: number; gm_grants?: Json; review_note?: string | null; updated_at?: string } | null = fullRow
    if (data && pilotId && !fullRow) privateRow = (await supabase.rpc('pilot_sheet', { target_character_id: data.id })).data?.[0] ?? null
    const loaded = data ? (row as Character) : null
    character.value = loaded
    playerName.value = player?.display_name ?? ''
    if (data && loaded) {
      sheet.value = (privateRow?.sheet ?? {}) as unknown as Sheet
      gm.value = { level: privateRow?.level ?? 0, manna: privateRow ? privateRow.manna ?? 0 : startingManna() }
      grants.value = (privateRow?.gm_grants ?? {}) as Grants
      reviewNote.value = privateRow?.review_note ?? ''
      sheetUpdatedAt.value = privateRow?.updated_at ?? ''
      // Your own sheet may not exist yet (the first save creates it), but it's still yours to fill in.
      canSeeBackstory.value = !pilotId || !!fullRow
      change.value = null
      approvedImages = new Set()
      approved.value = null
      if (data.status === 'approved' && (!pilotId || gmEditing.value)) {
        const latest = await latestChange(data.id)
        change.value = latest
        // Show the change in progress instead of the approved pilot (your own only).
        let proposed = null
        if (!pilotId && latest?.status === 'pending') {
          const read = await supabase.from('pending_changes').select('proposed_public, proposed_sheet').eq('id', latest.id).maybeSingle()
          if (read.error) loadError.value = readError(read.error.message)
          proposed = read.data
        }
        if (proposed) {
          approvedImages = cardImages(loaded)
          approved.value = { character: loaded, sheet: sheet.value }
          character.value = { ...loaded, ...(proposed.proposed_public as object) }
          // What's equipped is always the live list (equipGear below): approving a change keeps it, whatever the draft says.
          sheet.value = { ...(proposed.proposed_sheet as unknown as Sheet), equipped_gear: sheet.value.equipped_gear, misc_items: sheet.value.misc_items }
        }
      }
      savedImages = cardImages(loaded)
    }
    loading.value = false
  }

  // First save of the identity: creates the pending pilot, then its empty private sheet.
  async function create(fields: { pilot_name: string } & TablesUpdate<'characters'>) {
    const userId = session.value?.user.id
    if (!userId) return NOT_LOADED
    const { data, error } = await supabase
      .from('characters')
      .insert({ ...fields, player_id: userId })
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
    const result = queue.then(save, save) // a save that threw must not block the ones after it
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
  const card = (c: Character) => Object.fromEntries(PUBLIC_COLUMNS.map((column) => [column, c[column]])) as NonNullable<Json>

  // The card with these images was just saved: files it no longer uses can go.
  function swapImages(now: Set<string>) {
    dropImages([...savedImages].filter((path) => !now.has(path)))
    savedImages = now
  }

  async function write(kind: Kind) {
    const c = character.value
    if (!c) return NOT_LOADED
    const images = cardImages(c)
    if (kind === 'draft') {
      const d = draft.value
      if (!d) return NOT_LOADED
      const seen = d.updated_at
      const result = await checkWrite(
        await supabase
          .from('pending_changes')
          .update({ proposed_public: card(c), proposed_sheet: sheet.value as unknown as NonNullable<Json> })
          .eq('id', d.id)
          .eq('updated_at', seen)
          .select(CHANGE_FIELDS),
        { seen, recheck: recheckUpdatedAt('pending_changes', 'id', d.id) },
      )
      if (result.row) change.value = result.row
      if (!result.error) swapImages(images)
      return result.error
    }
    if (kind === 'card') {
      const result = await checkWrite(
        await supabase.from('characters').update(card(c) as TablesUpdate<'characters'>).eq('id', c.id).eq('updated_at', c.updated_at).select('updated_at'),
        { seen: c.updated_at, recheck: recheckUpdatedAt('characters', 'id', c.id) },
      )
      // Only the new updated_at: the card on screen may have newer edits that are still waiting their turn.
      if (result.row && character.value) character.value = { ...character.value, updated_at: result.row.updated_at }
      if (!result.error) swapImages(images)
      return result.error
    }
    // The first save of a sheet creates it; after that it's an update, guarded by when this page last saw it.
    // An approved pilot's player equips live (equipGear), which doesn't move updated_at, so a GM's save takes the equipped
    // list as it is now rather than as this page loaded it.
    // shortcut: an equip landing between this read and the write below is still lost; move to a database function if that bites.
    if (c.status === 'approved') {
      const { data, error } = await supabase.from('character_sheets').select('equipped:sheet->equipped_gear').eq('character_id', c.id).maybeSingle()
      if (error) return error.message
      sheet.value = { ...sheet.value, equipped_gear: (data?.equipped ?? undefined) as string[] | undefined }
    }
    const body = sheet.value as unknown as NonNullable<Json>
    // Grants are GM-only to change, so only a GM's edit mode sends them (one write with the sheet).
    const extra = gmEditing.value ? { gm_grants: grants.value as NonNullable<Json> } : {}
    const seen = sheetUpdatedAt.value
    const result = seen
      ? await checkWrite(await supabase.from('character_sheets').update({ sheet: body, ...extra }).eq('character_id', c.id).eq('updated_at', seen).select('updated_at'), {
          seen,
          recheck: recheckUpdatedAt('character_sheets', 'character_id', c.id),
        })
      : await checkWrite(await supabase.from('character_sheets').upsert({ character_id: c.id, sheet: body, ...extra }).select('updated_at'))
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
    if (!character.value) return Promise.resolve(NOT_LOADED)
    const before = mechs.value.length
    character.value = { ...character.value, ...changes }
    const kind = save(draft.value ? 'draft' : 'card')
    // An extra mech added or removed in GM edit mode changes the grants, which are saved with the sheet.
    if (!gmEditing.value || mechs.value.length === before) return kind
    grants.value = adjustGrants(grants.value, sheet.value, sheet.value, before, mechs.value.length)
    return Promise.all([kind, save('sheet')]).then((results) => results.find(Boolean) ?? null)
  }

  // Merges changes into the private sheet straight away, then saves it.
  function updateSheet(changes: Partial<Sheet>) {
    const before = sheet.value
    sheet.value = { ...sheet.value, ...changes }
    if (gmEditing.value) grants.value = adjustGrants(grants.value, before, sheet.value, 0, 0)
    return save(draft.value ? 'draft' : 'sheet')
  }

  // --- Changes to your approved pilot ---

  // A new draft: a copy of the pilot as this page loaded it, and when it last changed then (based_on), so approving
  // can tell if a GM has edited it since (approve_change refuses then). The strings are sent as they came (a Date
  // would drop the microseconds); Date.parse only picks the later one. The database clamps a value later than the
  // pilot's real last change.
  const proposeChange = () =>
    queued(async () => {
      const c = character.value
      const userId = session.value?.user.id
      if (!c || !userId) return NOT_LOADED
      const basedOn = [c.updated_at, sheetUpdatedAt.value].reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
      const { error } = await supabase.from('pending_changes').insert({
        character_id: c.id,
        submitted_by: userId,
        proposed_public: card(c),
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
      const d = draft.value
      if (!d) return NOT_LOADED
      const seen = d.updated_at
      const result = await checkWrite(
        await supabase
          .from('pending_changes')
          .update({ submitted_at: submitted ? new Date().toISOString() : null })
          .eq('id', d.id)
          .eq('updated_at', seen)
          .select(CHANGE_FIELDS),
        { seen, recheck: recheckUpdatedAt('pending_changes', 'id', d.id) },
      )
      if (result.row) change.value = result.row
      if (result.error === CHANGED_ELSEWHERE) conflict.value = true
      return submitted && result.error ? NOT_SUBMITTED + result.error : result.error
    })

  // Withdrawing deletes the change; the approved pilot shows again.
  const withdrawChange = () =>
    queued(async () => {
      const d = draft.value
      if (!d) return NOT_LOADED
      const { error } = await checkWrite(await supabase.from('pending_changes').delete().eq('id', d.id).select('id'))
      if (!error) {
        dropImages([...savedImages, ...(character.value ? cardImages(character.value) : [])])
        await load()
      }
      return error
    })

  // Equipping an approved pilot's owned gear (equip_pilot_gear: "keys" is the whole equipped list, owned keys) needs no
  // approval, even with a change open or in a GM's edit mode. It changes only the live sheet's equipped_gear; the draft's
  // copy follows it on screen.
  const equipGear = (keys: string[]) =>
    queued(async () => {
      if (!character.value) return NOT_LOADED
      const { error } = await supabase.rpc('equip_pilot_gear', { target_character_id: character.value.id, keys })
      if (error) return error.message
      if (approved.value) approved.value = { ...approved.value, sheet: { ...approved.value.sheet, equipped_gear: keys } }
      sheet.value = { ...sheet.value, equipped_gear: keys }
      return null
    })

  // Marking your approved pilot dead (mark_dead in the database): it moves to the memorial for good, any
  // waiting change is withdrawn, and you can register a new pilot.
  const markDead = () =>
    queued(async () => {
      if (!character.value) return NOT_LOADED
      const { error } = await supabase.rpc('mark_dead', { target_character_id: character.value.id })
      if (!error) await load()
      return error?.message ?? null
    })

  // A new pilot is a draft until you submit it (the GM queue and the Pending tab only list submitted pilots). Taking
  // it back makes it a draft again. The database stamps the time and clears a GM's sent-back note. It won't submit a
  // pilot whose latest edits didn't save.
  const setPilotSubmitted = (submitted: boolean) =>
    queued(async () => {
      if (submitted && unsaved.size) return unsavedError()
      const c = character.value
      if (!c) return NOT_LOADED
      const result = await checkWrite(
        await supabase
          .from('characters')
          .update({ submitted_at: submitted ? new Date().toISOString() : null })
          .eq('id', c.id)
          .eq('updated_at', c.updated_at)
          .select('updated_at, submitted_at'),
        { seen: c.updated_at, recheck: recheckUpdatedAt('characters', 'id', c.id) },
      )
      if (result.row && character.value) character.value = { ...character.value, ...result.row }
      if (result.row && submitted) reviewNote.value = ''
      if (result.error === CHANGED_ELSEWHERE) conflict.value = true
      return submitted && result.error ? NOT_SUBMITTED + result.error : result.error
    })

  // This clears only the approval message, including while a proposed edit is open.
  const dismissApprovalNote = () =>
    queued(async () => {
      if (!character.value) return NOT_LOADED
      const { error } = await supabase.rpc('dismiss_approval_note', {
        target_character_id: character.value.id,
        expected_note: reviewNote.value,
      })
      if (!error) reviewNote.value = ''
      return error?.message ?? null
    })

  load()
  // Entering edit mode on a record (or the profile arriving late): is the player's change open?
  watch(gmEditing, async (on) => {
    const c = character.value
    if (on) change.value = c?.status === 'approved' ? await latestChange(c.id) : null
  })

  return {
    character,
    sheet,
    gm,
    grants,
    reviewNote,
    sheetUpdatedAt,
    playerName,
    canSeeBackstory,
    canSeeManna: canSeeBackstory,
    loading,
    loadError,
    conflict,
    retry,
    editable,
    gmEditing,
    waiting,
    approved,
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
    equipGear,
    markDead,
  }
}
