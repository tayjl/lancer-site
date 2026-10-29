import { expect, it, vi } from 'vitest'
import { supabase } from './lib/supabaseClient'
import { useMyPilot, type PilotSnapshot } from './myPilot'

vi.mock('./auth', () => ({ session: { value: null } }))
vi.mock('./lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

it('shows an already-loaded review snapshot read-only without fetching the live pilot', () => {
  const snapshot = {
    character: { id: 10, pilot_name: 'Proposed name', status: 'pending', mechs: [] },
    sheet: { backstory: null, mech_skills: { hull: 3 } },
    gm: { level: 2, manna: 1200 },
    playerName: 'Player',
  } as unknown as PilotSnapshot
  const pilot = useMyPilot(10, snapshot)
  expect(pilot.character.value?.pilot_name).toBe('Proposed name')
  expect(pilot.sheet.value.mech_skills?.hull).toBe(3)
  expect(pilot.gm.value.manna).toBe(1200)
  expect(pilot.canSeePrivate.value).toBe(true)
  expect(pilot.loading.value).toBe(false)
  expect(pilot.editable.value).toBe(false)
  expect(supabase.from).not.toHaveBeenCalled()
})
