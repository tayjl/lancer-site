import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey)

export const NOT_ALLOWED = "you don't have permission to change this, or it no longer exists."
export const CHANGED_ELSEWHERE = 'this changed somewhere else.'
export const OFFLINE = "can't reach the database. Check your connection, then retry."

// Browsers word a failed request differently (Chrome "Failed to fetch", Firefox "NetworkError…", Safari "Load failed").
const OFFLINE_MESSAGES = /failed to fetch|networkerror|load failed/i

// Judges an update, upsert or delete that ends in .select(). A write RLS filters out returns no error and no rows, so
// zero rows is a failure too. Pass "recheck" (a read of the row's updated_at) and "seen" (the updated_at the write was
// guarded with) when the write had .eq('updated_at', seen): zero rows with a different updated_at means someone else
// saved first, so the error is CHANGED_ELSEWHERE. Returns the first row written, or the error message.
export async function checkWrite<T>(
  result: { data: T[] | null; error: { message: string } | null },
  guard?: { seen: string; recheck: () => PromiseLike<{ data: { updated_at: string } | null }> },
): Promise<{ row: T; error: null } | { row: null; error: string }> {
  if (result.error) return { row: null, error: OFFLINE_MESSAGES.test(result.error.message) ? OFFLINE : result.error.message }
  if (result.data?.length) return { row: result.data[0], error: null }
  const now = guard && (await guard.recheck()).data
  return { row: null, error: now && now.updated_at !== guard.seen ? CHANGED_ELSEWHERE : NOT_ALLOWED }
}
