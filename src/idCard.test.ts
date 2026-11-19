import { describe, expect, it } from 'vitest'
import { cardFilename, fitText, pilotSerial } from './idCard'

describe('pilot serial', () => {
  it('is deterministic and shaped HOR-0042-XXXX-XXXX', () => {
    expect(pilotSerial(42)).toBe(pilotSerial(42))
    expect(pilotSerial(42)).toMatch(/^HOR-0042-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/)
  })
  it('differs between pilots and keeps long ids whole', () => {
    expect(pilotSerial(42)).not.toBe(pilotSerial(43))
    expect(pilotSerial(12345)).toMatch(/^HOR-12345-/)
  })
})

describe('fitText', () => {
  const measure = (text: string) => text.length * 10
  it('leaves text that fits', () => expect(fitText('WARDEN', 100, measure)).toBe('WARDEN'))
  it('cuts text that does not, with an ellipsis that still fits', () => {
    const out = fitText('Wardenclyffe Tower', 100, measure)
    expect(out.endsWith('…')).toBe(true)
    expect(measure(out)).toBeLessThanOrEqual(100)
  })
  it('gives only the ellipsis when nothing fits', () => expect(fitText('Wardenclyffe', 5, measure)).toBe('…'))
})

describe('cardFilename', () => {
  it('makes a safe png name', () => {
    expect(cardFilename('WARDEN')).toBe('warden-id.png')
    expect(cardFilename('Lady / Luck!')).toBe('lady-luck-id.png')
    expect(cardFilename('???')).toBe('pilot-id.png')
  })
})
