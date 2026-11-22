import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey)

export const NOT_ALLOWED = "You don't have permission to change this."
export const CHANGED_ELSEWHERE = 'Someone else changed this.'
export const OFFLINE = "Can't reach the server. Check your connection."

// Browsers word a failed request differently (Chrome "Failed to fetch", Firefox "NetworkError…", Safari "Load failed").
const OFFLINE_MESSAGES = /failed to fetch|networkerror|load failed/i
// A read's error in plain words: a network failure becomes OFFLINE, anything else is passed on.
export const readError = (message: string) => (OFFLINE_MESSAGES.test(message) ? OFFLINE : message)

// Judges an update, upsert or delete that ends in .select(). A write RLS filters out returns no error and no rows, so
// zero rows is a failure too. Pass "recheck" (a read of the row's updated_at) and "seen" (the updated_at the write was
// guarded with) when the write had .eq('updated_at', seen): zero rows with a different updated_at means someone else
// saved first, so the error is CHANGED_ELSEWHERE. Returns the first row written, or the error message.
export async function checkWrite<T>(
  result: { data: T[] | null; error: { message: string } | null },
  guard?: { seen: string; recheck: () => PromiseLike<{ data: { updated_at: string } | null }> },
): Promise<{ row: T; error: null } | { row: null; error: string }> {
  if (result.error) return { row: null, error: readError(result.error.message) }
  if (result.data?.length) return { row: result.data[0], error: null }
  const now = guard && (await guard.recheck()).data
  return { row: null, error: now && now.updated_at !== guard.seen ? CHANGED_ELSEWHERE : NOT_ALLOWED }
}

// Supabase returns at most 1,000 rows a request (max_rows in supabase/config.toml), so a long list is read a page at a time.
const PAGE_SIZE = 1000

// Reads every row of a list. "page" builds the query for one slice, e.g.
//   fetchAll((from, to) => supabase.from('content_items').select('id').order('id').range(from, to))
// and must sort by something unique, or rows can repeat or go missing between pages. Returns all the rows, or the
// error message (and no rows) if any page fails, so a half-loaded list is never shown as the whole.
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: null } | { rows: never[]; error: string }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) return { rows: [], error: OFFLINE_MESSAGES.test(error.message) ? OFFLINE : error.message }
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGE_SIZE) return { rows, error: null }
  }
}
