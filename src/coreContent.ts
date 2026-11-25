// Loaded on demand so the official data does not enlarge the initial app download.
// This pinned release uses the data format already supported by the character sheets.
import frames from '@massif/lancer-data/lib/frames.json'
import weapons from '@massif/lancer-data/lib/weapons.json'
import systems from '@massif/lancer-data/lib/systems.json'
import mods from '@massif/lancer-data/lib/mods.json'
import pilot_gear from '@massif/lancer-data/lib/pilot_gear.json'
import talents from '@massif/lancer-data/lib/talents.json'
import core_bonuses from '@massif/lancer-data/lib/core_bonuses.json'
import tags from '@massif/lancer-data/lib/tags.json'
import manufacturers from '@massif/lancer-data/lib/manufacturers.json'
import { version } from '@massif/lancer-data/package.json'
import type { Json } from './lib/database.types'
import { actionData, BASE_ACTIONS } from './baseActions'
import { RULES_SEED, ruleData } from './rulesData'
import { withoutActiveEffects, type LcpKind, type LcpPack } from './lcp'

// The campaign's wording, for tags the official text writes for dice. Only the seed, so the owner's edits still win.
const WORDING: Record<string, string> = {
  tg_overkill: 'Before an attack you can take 1 Heat to add +2 damage, once per attack.',
  tg_reliable: 'Always deals at least {VAL} damage, even on a miss.',
  tg_knockback: 'On a full hit or crit, the target is knocked back by {VAL}. Never on a grazing hit.',
}

export const coreContent: LcpPack = {
  manifest: {
    name: 'LANCER Core', author: 'Massif Press', version,
    description: 'Official LANCER core pilot and mech content.',
    source: '@massif/lancer-data', core: true,
  },
  items: [...Object.entries({ frames, weapons, systems, mods, pilot_gear, talents, core_bonuses, tags, manufacturers }).flatMap(([kind, rows]) =>
    (rows as unknown as Record<string, Json>[])
      // COMP/CON's missing-data placeholders are not playable equipment.
      .filter(row => typeof row.id === 'string' && !row.id.startsWith('missing_'))
      .map(data => ({ id: String(data.id), kind: kind as LcpKind, data: { ...withoutActiveEffects(data), ...(kind === 'tags' && WORDING[String(data.id)] ? { description: WORDING[String(data.id)] } : {}) } })),
  ),
  // The Combat page's base actions, so the owner can reword them in the editor.
  ...BASE_ACTIONS.map(a => ({ id: a.id, kind: 'actions' as LcpKind, data: actionData(a) as Record<string, Json> })),
  // The Combat page's rules (wording and numbers), editable the same way.
  ...RULES_SEED.map(r => ({ id: r.id, kind: 'rules' as LcpKind, data: ruleData(r) as Record<string, Json> })),
  ],
  ignored: [],
  warnings: [],
}
