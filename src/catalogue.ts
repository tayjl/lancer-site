import { computed, reactive } from 'vue'
import type { Json } from './lib/database.types'
import { fetchAll, supabase } from './lib/supabaseClient'

// Game content (frames, weapons, talents, tags and so on) is read once per browser session and shared by every page.
// A failed read isn't kept, so the next page that asks tries again. Importing a pack clears the lot (clearCatalogues).
type Loaded<T> = { rows: T[]; error: string | null }
const cache = new Map<string, Promise<Loaded<never>>>()
const failures = reactive(new Map<string, string>())

// Why game content didn't load, or '' when it did. Pages show it once, as <CatalogueNotice />.
export const catalogueError = computed(() => [...failures.values()][0] ?? '')

export function cached<T>(key: string, load: () => Promise<Loaded<T>>): Promise<Loaded<T>> {
  const hit = cache.get(key) as Promise<Loaded<T>> | undefined
  if (hit) return hit
  const own: Promise<Loaded<T>> = load().then((result) => {
    if (!result.error) failures.delete(key)
    else {
      failures.set(key, result.error)
      if (cache.get(key) === own) cache.delete(key)
    }
    return result
  })
  cache.set(key, own as Promise<Loaded<never>>)
  return own
}

export const clearCatalogues = () => cache.clear()

// Every published content_items row of one kind (frames, weapons, systems, talents, pilot_gear, core_bonuses, tags,
// manufacturers...). "data" is the campaign's edited version when an owner has edited the item (content_items.edited,
// which pack updates never touch), else the pack's own. Drafts (homebrew an owner hasn't published) are left out, so no
// page or picker offers them. Every page that reads game content goes through here, so they all see edits.
export const loadKind = (kind: string) =>
  cached(`content:${kind}`, async () => {
    const { rows, error } = await fetchAll((from, to) =>
      supabase.from('content_items').select('id, kind, data, edited').eq('kind', kind).eq('draft', false).order('id').range(from, to))
    return { rows: rows.map(({ id, kind, data, edited }) => ({ id, kind, data: edited ?? data })), error } as Loaded<{ id: string; kind: string; data: Json }>
  })

// Items an owner hid (data.hidden, or edited.hidden: loadKind already merges the two) stay in every list so a pilot who has
// one still sees it on the sheet. Pickers and archive lists leave them out with this, keeping any "keep" says is in use.
export const offered = <T extends { hidden?: boolean }>(list: T[], keep: (item: T) => boolean = () => false) => list.filter((item) => !item.hidden || keep(item))
