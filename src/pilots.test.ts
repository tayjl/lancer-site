import { describe, expect, it, vi } from 'vitest'
import { pilotMatches, type PilotCardRow } from './pilots'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

const pilot = { callsign: 'WARDEN', pilot_name: 'Ada Vey', player_name: 'tay' } as PilotCardRow

describe('pilotMatches', () => {
  it('matches every word against callsign, name and player, ignoring case', () => {
    expect(pilotMatches(pilot, '')).toBe(true)
    expect(pilotMatches(pilot, 'warden')).toBe(true)
    expect(pilotMatches(pilot, 'vey  TAY warden')).toBe(true)
    expect(pilotMatches(pilot, 'warden halfmoon')).toBe(false)
  })

  it('copes with no callsign or player', () => {
    expect(pilotMatches({ ...pilot, callsign: null, player_name: null } as unknown as PilotCardRow, 'ada')).toBe(true)
  })
})
