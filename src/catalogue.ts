import { computed, reactive } from 'vue'
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

// Every content_items row of one kind (frames, weapons, systems, talents, pilot_gear, core_bonuses, tags, manufacturers...).
export const loadKind = (kind: string) =>
  cached(`content:${kind}`, () => fetchAll((from, to) => supabase.from('content_items').select('id, kind, data').eq('kind', kind).order('id').range(from, to)))
