import { beforeEach, describe, expect, it, vi } from 'vitest'

// A fake database for one approved pilot with a draft change: records every update, and answers by "mode".
const db = vi.hoisted(() => ({ updates: [] as { payload: any }[], mode: 'ok' as 'ok' | 'fail' | 'zero', stored: 'd0', n: 0, newPilot: false }))

vi.mock('./auth', () => ({ isGm: { value: false }, session: { value: { user: { id: 'u' } } } }))
vi.mock('./lib/supabaseClient', async (original) => {
  const real = await original<typeof import('./lib/supabaseClient')>()
  const row = (table: string) =>
    table === 'characters'
      ? { id: 1, status: db.newPilot ? 'pending' : 'approved', submitted_at: null, callsign: 'A', pilot_name: 'B', mechs: [], updated_at: 'c0', player: null }
      : table === 'character_sheets'
        ? { sheet: {}, level: 0, manna: 0, review_note: null, updated_at: 's0' }
        : { id: 7, character_id: 1, status: 'pending', submitted_at: null, updated_at: db.stored, proposed_public: {}, proposed_sheet: {} }
  const from = (table: string) => {
    let payload: any
    let write = false
    const b: any = new Proxy(() => {}, {
      get: (_, key) => {
        if (key === 'then') {
          return (resolve: (value: unknown) => void) => {
            if (!write) return resolve({ data: row(table), error: null })
            if (db.mode === 'fail') return resolve({ data: null, error: { message: 'down' } })
            if (db.mode === 'zero') return resolve({ data: [], error: null })
            db.updates.push({ payload })
            db.stored = 'd' + ++db.n
            resolve({ data: [{ ...row(table), ...(payload?.submitted_at !== undefined && { submitted_at: payload.submitted_at }), updated_at: db.stored }], error: null })
          }
        }
        return (arg: unknown) => {
          if (key === 'update') ((write = true), (payload = arg))
          return b
        }
      },
    })
    return b
  }
  return { ...real, supabase: { from } }
})

import { useMyPilot } from './myPilot'

async function open() {
  const pilot = useMyPilot()
  await vi.waitFor(() => expect(pilot.loading.value).toBe(false))
  return pilot
}

beforeEach(() => Object.assign(db, { updates: [], mode: 'ok', stored: 'd0', n: 0, newPilot: false }))

describe('saving a draft change', () => {
  it('sends the latest card each time, so quick edits do not undo each other', async () => {
    const pilot = await open()
    await Promise.all([pilot.updateCharacter({ callsign: 'A2' }), pilot.updateCharacter({ pilot_name: 'B2' })])
    expect(db.updates.at(-1)!.payload.proposed_public).toMatchObject({ callsign: 'A2', pilot_name: 'B2' })
  })

  it('keeps a failed edit on screen and sends it again on retry', async () => {
    const pilot = await open()
    db.mode = 'fail'
    expect(await pilot.updateCharacter({ callsign: 'A2' })).toBe('down')
    expect(pilot.character.value!.callsign).toBe('A2')
    db.mode = 'ok'
    expect(await pilot.retry()).toBeNull()
    expect(db.updates.at(-1)!.payload.proposed_public.callsign).toBe('A2')
    expect(await pilot.retry()).toBeNull() // nothing left to send
    expect(db.updates).toHaveLength(1)
  })

  it('stops saving once the change was saved somewhere else', async () => {
    const pilot = await open()
    db.mode = 'zero'
    db.stored = 'd9' // the row moved on since this page loaded it (d0)
    await pilot.updateCharacter({ callsign: 'A2' })
    expect(pilot.conflict.value).toBe(true)
    db.mode = 'ok'
    expect(await pilot.updateCharacter({ callsign: 'A3' })).toMatch(/Someone else changed this/)
    expect(db.updates).toHaveLength(0)
  })
})

describe('submitting a new pilot', () => {
  it('is a draft until submitted, then read-only until taken back', async () => {
    db.newPilot = true
    const pilot = await open()
    expect(pilot.editable.value).toBe(true)
    expect(await pilot.submitPilot()).toBeNull()
    expect(db.updates.at(-1)!.payload.submitted_at).toEqual(expect.any(String))
    expect(pilot.character.value!.submitted_at).toBeTruthy()
    expect(pilot.editable.value).toBe(false)
    expect(await pilot.reopenPilot()).toBeNull()
    expect(db.updates.at(-1)!.payload.submitted_at).toBeNull()
    expect(pilot.editable.value).toBe(true)
  })

  it('will not submit while an edit is unsaved', async () => {
    db.newPilot = true
    const pilot = await open()
    db.mode = 'fail'
    await pilot.updateCharacter({ callsign: 'A2' })
    db.mode = 'ok'
    expect(await pilot.submitPilot()).toMatch(/not saved yet/)
    expect(db.updates).toHaveLength(0)
  })
})
