import { describe, expect, it } from 'vitest'
import { describeReward, rewardsProblem } from './rewards'

describe('rewards', () => {
  it('words a log row like the change review', () => {
    expect(describeReward({ field: 'manna', old_value: 1500, new_value: 2000 })).toEqual({ text: 'Manna 1,500 → 2,000', up: true })
    expect(describeReward({ field: 'experience', old_value: 1000, new_value: 0 })).toEqual({ text: 'Experience 1,000 → 0', up: false })
  })

  it('checks typed numbers', () => {
    expect(rewardsProblem({ level: 2, manna: 0, experience: 1000 })).toBe('')
    expect(rewardsProblem({ experience: 1001 })).toMatch(/at most 1000/)
    expect(rewardsProblem({ level: -1 })).toMatch(/whole numbers/)
    expect(rewardsProblem({ manna: 1.5 })).toMatch(/whole numbers/)
    expect(rewardsProblem({ manna: Number.NaN })).toMatch(/whole numbers/)
  })
})
