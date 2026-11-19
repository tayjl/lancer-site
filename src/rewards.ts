import { supabase } from './lib/supabaseClient'
import { formatAmount } from './rules'

// GM-only rewards: level, manna received and experience (0 to 1000), all set through the award() database function,
// which logs every change (pilot_reward_log). At 1000 experience a pilot is "ready to level"; a GM raises the level
// with level_up(). Nothing here is secret-by-the-page: the database refuses everyone else.
export const EXPERIENCE_MAX = 1000
export type Rewards = { level?: number; manna?: number; experience?: number }

// A plain sentence when a typed number can't be saved, else ''.
export function rewardsProblem(changes: Rewards) {
  for (const value of Object.values(changes)) if (!Number.isSafeInteger(value) || value < 0) return 'Level, manna and experience must be whole numbers, 0 or more.'
  return (changes.experience ?? 0) > EXPERIENCE_MAX ? `Experience is at most ${EXPERIENCE_MAX}.` : ''
}

// Both return an error message, or null when it worked. An unset field is left unchanged.
export async function award(characterId: number, changes: Rewards, reason?: string) {
  const { error } = await supabase.rpc('award', {
    target_character_id: characterId,
    new_level: changes.level,
    new_manna: changes.manna,
    new_experience: changes.experience,
    reason: reason?.trim() || undefined,
  })
  return error?.message ?? null
}

export async function levelUp(characterId: number, reason?: string) {
  const { error } = await supabase.rpc('level_up', { target_character_id: characterId, reason: reason?.trim() || undefined })
  return error?.message ?? null
}

// One log row in the change review's words: "Manna 1,500 → 2,000" and whether it went up or down.
const FIELD_NAMES: Record<string, string> = { level: 'Level', manna: 'Manna', experience: 'Experience' }
export function describeReward(row: { field: string; old_value: number; new_value: number }) {
  const name = FIELD_NAMES[row.field] ?? row.field
  return { text: `${name} ${formatAmount(row.old_value)} → ${formatAmount(row.new_value)}`, up: row.new_value > row.old_value }
}
