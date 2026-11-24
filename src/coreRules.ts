import type { Bonus } from './gameData'

// The pinned core dataset leaves these permanent check modifiers in prose. Keep the small, explicit
// supplement keyed by official ids; never infer mechanics by matching arbitrary imported descriptions.
export const CORE_CHECK_BONUSES: Record<string, Bonus[]> = {
  mf_blackbeard: [{ id: 'engineering', accuracy: -1, val: 0 }],
  mf_drake: [{ id: 'agility', accuracy: -1, val: 0 }],
  mf_deaths_head: [{ id: 'attack', val: 1, weapon_types: ['Rifle', 'Cannon', 'Launcher', 'CQB', 'Nexus'] }],
  mf_dusk_wing: [{ id: 'hull', accuracy: -1, val: 0 }],
  mf_mourning_cloak: [{ id: 'agility', accuracy: 1, val: 0 }],
  mf_goblin: [{ id: 'hull', accuracy: -1, val: 0 }, { id: 'tech_attack', accuracy: 1, val: 0 }],
  mf_barbarossa: [{ id: 'agility', accuracy: -1, val: 0 }],
  mf_sherman: [{ id: 'engineering', accuracy: 1, val: 0 }],
  cb_gyges_frame: [{ id: 'hull', accuracy: 1, val: 0 }],
  cb_kai_bioplating: [{ id: 'agility', accuracy: 1, val: 0 }],
  cb_the_lesson_of_disbelief: [{ id: 'systems', accuracy: 1, val: 0 }],
  cb_armory_sculpted_chassis: [{ id: 'engineering', accuracy: 1, val: 0 }],
}

// The check modifiers a frame's core power asks for. The frame's own core_system.check_bonuses wins (any frame, homebrew
// included, and an empty list means none); official frames without the field keep the table above. Anything that isn't a
// list of bonus objects is ignored.
export function coreCheckBonuses(frameId: string, core?: Record<string, unknown>): Bonus[] {
  const own = core?.check_bonuses
  if (!Array.isArray(own)) return CORE_CHECK_BONUSES[frameId] ?? []
  return own.filter((row): row is Bonus => !!row && typeof row === 'object' && typeof (row as Bonus).id === 'string')
}
