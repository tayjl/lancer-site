import { ref, shallowRef } from 'vue'
import type { Tables, TablesUpdate } from './lib/database.types'
import { checkWrite, supabase } from './lib/supabaseClient'
import { docText, wordCount } from './richTextSafe'
import { formatDate } from './time'

// Lore: stories, places, factions, people and events the GMs write (the lore_entries table). Everyone logged in
// reads published entries; the database hands GMs and owners the drafts too, and only they can write.

export const LORE_KINDS = ['story', 'place', 'faction', 'person', 'event'] as const
export type LoreKind = (typeof LORE_KINDS)[number]

// Singular and plural names, and each kind's symbol (src/assets/icons).
export const KIND_INFO: Record<LoreKind, { name: string; plural: string; icon: string }> = {
  story: { name: 'Story', plural: 'Stories', icon: 'book-open' },
  place: { name: 'Place', plural: 'Places', icon: 'map-pin' },
  faction: { name: 'Faction', plural: 'Factions', icon: 'flag' },
  person: { name: 'Person', plural: 'People', icon: 'user' },
  event: { name: 'Event', plural: 'Events', icon: 'calendar' },
}

// "author" is the writer's profile, joined in for their display name (as the pilots' player is).
export type LoreEntry = Omit<Tables<'lore_entries'>, 'kind'> & { kind: LoreKind; author: { display_name: string } | null }

export const isKind = (value: string): value is LoreKind => (LORE_KINDS as readonly string[]).includes(value)
export const isDraft = (entry: Pick<LoreEntry, 'published_at'>) => entry.published_at === null

// The date a list is ordered by: when it was published, or (a draft) when it was last edited.
export const entryDate = (entry: LoreEntry) => entry.published_at ?? entry.updated_at

// Reading time: the body's words at 200 a minute, rounded up, never under a minute.
export const readMinutes = (body: unknown) => Math.max(1, Math.ceil(wordCount(body) / 200))
export const readTime = (body: unknown) => `${readMinutes(body)} min read`

// A list row's and the entry's line under the title: "12 Nov 2026 · 3 min read" ("Edited …" for a draft).
export const entryMeta = (entry: LoreEntry) => `${isDraft(entry) ? 'Edited ' : ''}${formatDate(entryDate(entry))} · ${readTime(entry.body)}`

// The search: every typed word must appear in the title, summary or body text.
export function loreMatches(entry: Pick<LoreEntry, 'title' | 'summary' | 'body'>, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const text = `${entry.title} ${entry.summary} ${docText(entry.body)}`.toLowerCase()
  return words.every((word) => text.includes(word))
}

// Pithub's file look: "The Karrakin Ledger!" -> "the_karrakin_ledger.omnif".
export const fileName = (title: string) => `${title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'untitled'}.omnif`

// Body length as "812b" under 1000 characters, else "2.1k".
export function fileSize(body: unknown) {
  const length = docText(body).length
  return length < 1000 ? `${length}b` : `${(length / 1000).toFixed(1)}k`
}

const sorted = (list: LoreEntry[]) => [...list].sort((a, b) => entryDate(b).localeCompare(entryDate(a)))

type LoreTable = 'lore_entries' | 'pithub_entries'
type LoreFields = Pick<TablesUpdate<'lore_entries'>, 'title' | 'kind' | 'summary' | 'body' | 'related' | 'published_at'>

// One store per table. "entries" is everything the user may read, newest first. Shared by the pages, so moving between
// them shows entries at once while the latest are fetched again.
function loreStore(table: LoreTable) {
  const entries = shallowRef<LoreEntry[]>([])
  const loaded = ref(false)
  // shortcut: pithub_entries has lore_entries' exact columns, so one table type serves both; split the types if they ever differ.
  const from = () => supabase.from(table as 'lore_entries')

  // Writes run one after another, and a fetch waits for them, so a save can't be overtaken (or overwritten by a
  // stale read of the list).
  let queue: Promise<unknown> = Promise.resolve()
  const queued = <T>(run: () => PromiseLike<T>): Promise<T> => {
    const result = queue.then(run, run)
    queue = result
    return result
  }

  // Returns an error message, or '' when it worked.
  async function load() {
    const { data, error } = await queued(() => from().select('*, author:profiles(display_name)'))
    if (!error) {
      entries.value = sorted(data as unknown as LoreEntry[])
      loaded.value = true
    }
    return error?.message ?? ''
  }

  // A new draft: the GM fills it in on its edit page. Returns the new id, or an error message.
  async function createDraft() {
    const { data, error } = await queued(() => from().insert({ title: 'Untitled entry', kind: 'story' }).select('id').single())
    return { id: data?.id ?? '', error: error?.message ?? '' }
  }

  // Saves some fields of one entry (in order, after earlier saves), keeping the shared list current. It only writes if the
  // entry is still the version the list holds (loaded or last saved here): if someone else saved it since, nothing is
  // written and the error is CHANGED_ELSEWHERE. Returns an error message, or null.
  function save(id: string, fields: LoreFields) {
    return queued(async () => {
      const seen = entries.value.find((entry) => entry.id === id)?.updated_at ?? ''
      const result = await checkWrite(await from().update(fields).eq('id', id).eq('updated_at', seen).select('*'), {
        seen,
        recheck: () => from().select('updated_at').eq('id', id).maybeSingle(),
      })
      // The author never changes, so the entry keeps the one it has.
      const row = result.row as unknown as Omit<LoreEntry, 'author'> | null
      if (row) entries.value = sorted(entries.value.map((entry) => (entry.id === id ? { ...entry, ...row } : entry)))
      return result.error
    })
  }

  function remove(id: string) {
    return queued(async () => {
      const { error } = await checkWrite(await from().delete().eq('id', id).select('id'))
      if (!error) entries.value = entries.value.filter((entry) => entry.id !== id)
      return error
    })
  }

  return { entries, loaded, load, createDraft, save, remove }
}

// Each section's table, routes and wording. The views pick one by route meta.section; two stores, so moving between
// lore and Pithub never mixes their lists.
export const LORE_SECTIONS = {
  lore: { name: 'Lore', empty: 'No lore yet.', list: 'lore', entry: 'lore-entry', edit: 'lore-edit', links: true, plain: false, store: loreStore('lore_entries') },
  pithub: { name: 'Pithub', empty: 'No entries yet.', list: 'pithub', entry: 'pithub-entry', edit: 'pithub-edit', links: false, plain: true, store: loreStore('pithub_entries') },
}
export const loreSection = (section: unknown) => LORE_SECTIONS[section === 'pithub' ? 'pithub' : 'lore']
