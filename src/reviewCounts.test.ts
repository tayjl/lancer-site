import { beforeEach, describe, expect, it, vi } from 'vitest'

// Each table answers its count read with what "counts" holds for it.
const counts = vi.hoisted(() => ({ characters: { count: 2 } as { count: number | null }, pending_changes: { count: 3 } as { count: number | null } }))
vi.mock('./lib/supabaseClient', () => {
  const from = (table: keyof typeof counts) => {
    const query: Record<string, unknown> = { select: () => query, eq: () => query, not: () => query, then: (resolve: (value: unknown) => void) => resolve(counts[table]) }
    return query
  }
  return { supabase: { from } }
})

import { loadReviewCounts, waitingChanges, waitingPilots } from './reviewCounts'

beforeEach(() => {
  waitingPilots.value = 0
  waitingChanges.value = 0
})

describe('loadReviewCounts', () => {
  it('sets both counts', async () => {
    await loadReviewCounts()
    expect([waitingPilots.value, waitingChanges.value]).toEqual([2, 3])
  })

  it('keeps the last number when a count fails', async () => {
    await loadReviewCounts()
    counts.characters.count = null
    counts.pending_changes.count = 0
    await loadReviewCounts()
    expect([waitingPilots.value, waitingChanges.value]).toEqual([2, 0])
  })
})
