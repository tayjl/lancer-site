import { beforeEach, describe, expect, it, vi } from 'vitest'

// The read answers with "read"; set_backstory_public with "rpc".
const fake = vi.hoisted(() => ({
  read: { data: null as { backstory: unknown } | null, error: null as { message: string } | null },
  rpc: { error: null as { message: string } | null },
}))
vi.mock('./lib/supabaseClient', async (original) => {
  const query: Record<string, unknown> = { select: () => query, eq: () => query, maybeSingle: async () => fake.read }
  return { ...(await original<typeof import('./lib/supabaseClient')>()), supabase: { from: () => query, rpc: async () => fake.rpc } }
})

import { useBackstoryVisibility } from './backstory'

beforeEach(() => {
  fake.read = { data: null, error: null }
  fake.rpc = { error: null }
})

describe('useBackstoryVisibility', () => {
  it('is public when a copy exists', async () => {
    fake.read.data = { backstory: { text: 'hi' } }
    const b = useBackstoryVisibility(() => 1)
    await vi.waitFor(() => expect(b.loading.value).toBe(false))
    expect(b.isPublic.value).toBe(true)
    expect(b.copy.value).toEqual({ text: 'hi' })
  })

  it('is private when there is no copy', async () => {
    const b = useBackstoryVisibility(() => 1)
    await vi.waitFor(() => expect(b.loading.value).toBe(false))
    expect([b.isPublic.value, b.copy.value]).toEqual([false, null])
  })

  it('keeps the last state and shows the error when the read fails', async () => {
    fake.read.data = { backstory: { text: 'hi' } }
    const b = useBackstoryVisibility(() => 1)
    await vi.waitFor(() => expect(b.loading.value).toBe(false))
    fake.read = { data: null, error: { message: 'down' } }
    fake.rpc = { error: null }
    expect(await b.set(false)).toBeNull()
    expect(b.error.value).toBe('down')
    expect(b.isPublic.value).toBe(true)
    expect(b.copy.value).toEqual({ text: 'hi' })
  })

  it('returns the error and does not reload when the change fails', async () => {
    const b = useBackstoryVisibility(() => 1)
    await vi.waitFor(() => expect(b.loading.value).toBe(false))
    fake.read.data = { backstory: {} }
    fake.rpc = { error: { message: 'no' } }
    expect(await b.set(true)).toBe('no')
    expect(b.isPublic.value).toBe(false)
  })

  it('words an offline failure plainly', async () => {
    const b = useBackstoryVisibility(() => 1)
    await vi.waitFor(() => expect(b.loading.value).toBe(false))
    fake.rpc = { error: { message: 'Failed to fetch' } }
    expect(await b.set(true)).not.toContain('Failed to fetch')
  })

  it('refuses to change without a pilot', async () => {
    const b = useBackstoryVisibility(() => undefined)
    expect(await b.set(true)).toBe('Pilot not found.')
  })

  it('does not read without a pilot', async () => {
    const b = useBackstoryVisibility(() => undefined)
    await Promise.resolve()
    expect(b.loading.value).toBe(true)
  })
})
