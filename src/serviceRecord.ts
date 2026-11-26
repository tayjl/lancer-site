import { ref, shallowRef, watch } from 'vue'
import type { Json, Tables } from './lib/database.types'
import { checkWrite, fetchAll, recheckUpdatedAt, supabase } from './lib/supabaseClient'

// A pilot's service record (the pilot_timeline table): dated entries written by the pilot's player ("player"), by GMs
// ("gm") and by the site itself when something notable happens ("auto", made by database triggers). Public to every
// logged-in user, and saved live with no approval. The database decides who may write which kind.

export type TimelineKind = 'player' | 'gm' | 'auto'
export type TimelineEntry = Pick<Tables<'pilot_timeline'>, 'id' | 'character_id' | 'title' | 'body' | 'occurred_on' | 'created_at' | 'updated_at'> & { kind: TimelineKind }

export const TITLE_MAX = 100
export const SHOWN = 10

// How each kind is marked: a symbol and a short word, never colour alone.
export const KIND_MARK: Record<TimelineKind, { icon: string; label: string }> = {
  player: { icon: 'pilot', label: 'Log' },
  gm: { icon: 'shield', label: 'GM' },
  auto: { icon: 'flag', label: 'Record' },
}

// Newest first: by the date the entry is about, then by when it was written (several can share a day).
export const sortTimeline = (entries: TimelineEntry[]) =>
  [...entries].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))

// The first few of a sorted list, or all of it.
export const shownEntries = (sorted: TimelineEntry[], showAll: boolean) => (showAll ? sorted : sorted.slice(0, SHOWN))

// Today's date as a form's default (YYYY-MM-DD, the local day, not the UTC one).
export const today = () => new Date().toLocaleDateString('en-CA')

// "3 Nov 2026" for a date-only value, read as that local day (new Date('2026-11-03') would be UTC midnight).
export const formatDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// What a form may save: a title of 1 to 100 characters and a real date. Returns the first problem, or null.
export function entryProblem(title: string, day: string) {
  if (!title.trim()) return 'An entry needs a title.'
  if (title.trim().length > TITLE_MAX) return `A title is at most ${TITLE_MAX} characters.`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return 'Pick a date.'
  return null
}

export type EntryFields = { title: string; occurred_on: string; body: Json | null }

// Loads one pilot's entries and writes them. Every write returns an error message, or null; an edit only goes through
// if the entry is still the version this page loaded (otherwise "changed somewhere else").
export function useServiceRecord(characterId: () => number | undefined) {
  const entries = shallowRef<TimelineEntry[]>([])
  const loaded = ref(false)
  const loadError = ref('')

  async function load() {
    const id = characterId()
    if (id === undefined) return
    const { rows, error } = await fetchAll((from, to) => supabase.from('pilot_timeline').select('*').eq('character_id', id).order('id').range(from, to))
    loadError.value = error ?? ''
    if (!error) entries.value = rows as TimelineEntry[]
    loaded.value = !error
  }
  watch(characterId, load, { immediate: true })

  async function add(kind: 'player' | 'gm', fields: EntryFields) {
    const result = await checkWrite(await supabase.from('pilot_timeline').insert({ character_id: characterId()!, kind, ...fields }).select('*'))
    if (result.row) entries.value = [...entries.value, result.row as TimelineEntry]
    return result.error
  }

  async function edit(entry: TimelineEntry, fields: EntryFields) {
    const result = await checkWrite(await supabase.from('pilot_timeline').update(fields).eq('id', entry.id).eq('updated_at', entry.updated_at).select('*'), {
      seen: entry.updated_at,
      recheck: recheckUpdatedAt('pilot_timeline', 'id', entry.id),
    })
    if (result.row) entries.value = entries.value.map((e) => (e.id === entry.id ? (result.row as TimelineEntry) : e))
    return result.error
  }

  async function remove(entry: TimelineEntry) {
    const result = await checkWrite(await supabase.from('pilot_timeline').delete().eq('id', entry.id).select('id'))
    if (result.row) entries.value = entries.value.filter((e) => e.id !== entry.id)
    return result.error
  }

  return { entries, loaded, loadError, load, add, edit, remove }
}
