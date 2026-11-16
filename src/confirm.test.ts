import { describe, expect, it } from 'vitest'
import { answerConfirm, confirmAction, shownConfirm } from './confirm'

describe('confirmAction', () => {
  it('resolves true when confirmed and false when cancelled', async () => {
    const yes = confirmAction('scrap this mech?', { danger: true })
    expect(shownConfirm.value).toMatchObject({ message: 'scrap this mech?', danger: true, confirmLabel: 'Confirm' })
    answerConfirm(true)
    expect(await yes).toBe(true)
    expect(shownConfirm.value).toBeNull()

    const no = confirmAction('withdraw?')
    answerConfirm(false)
    expect(await no).toBe(false)
  })

  it('answers an open question "no" when a new one replaces it, and ignores a second answer', async () => {
    const first = confirmAction('first?')
    const second = confirmAction('second?', { confirmLabel: 'go' })
    expect(await first).toBe(false)
    answerConfirm(true)
    answerConfirm(false)
    expect(await second).toBe(true)
  })
})
