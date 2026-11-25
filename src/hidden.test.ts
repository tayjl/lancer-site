import { describe, expect, it, vi } from 'vitest'
import { archiveEntries, type ArchiveContent } from './archive'
import { offered } from './catalogue'
import { loadCommendations } from './commendations'
import { loadList, saveLine } from './editorStore'
import { toCoreBonus, toItem, toTalent } from './gameData'
import { licenceUnlocks } from './info'
import { toFrame } from './mechData'

// A fake query that records the filters and answers with the rows set for the table.
const filters: [string, string, unknown][] = []
let table = ''
const answers: Record<string, unknown[]> = {}
vi.mock('./lib/supabaseClient', async (importOriginal) => {
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => (filters.push([table, column, value]), query),
    order: () => query,
    range: async () => ({ data: answers[table] ?? [], error: null }),
  }
  return { ...(await importOriginal<typeof import('./lib/supabaseClient')>()), supabase: { from: (name: string) => ((table = name), query) } }
})

const weapons = [toItem('visible', { name: 'Visible' }), toItem('secret', { name: 'Secret', hidden: true })]

describe('hidden items', () => {
  it('drop out of a picker list but still resolve by id', () => {
    expect(offered(weapons).map((w) => w.id)).toEqual(['visible'])
    expect(new Map(weapons.map((w) => [w.id, w])).get('secret')?.name).toBe('Secret')
  })
  it('stay in a list for the one in use', () => {
    expect(offered(weapons, (w) => w.id === 'secret').map((w) => w.id)).toEqual(['visible', 'secret'])
  })
  it('are marked on items, frames, talents and core bonuses, and only when hidden', () => {
    expect(toItem('a', { hidden: true }).hidden).toBe(true)
    expect(toItem('a', {}).hidden).toBeUndefined()
    expect(toFrame('f', { hidden: true }).hidden).toBe(true)
    expect(toTalent('t', { hidden: true }).hidden).toBe(true)
    expect(toCoreBonus('c', { hidden: true }).hidden).toBe(true)
  })
  it('leave the archive lists', () => {
    const content = { manufacturers: [], frames: [], weapons, systems: [], mods: [], gear: [], biomods: [], talents: [], coreBonuses: [] } as unknown as ArchiveContent
    expect(archiveEntries(content).map((entry) => entry.id)).toEqual(['visible'])
  })
})

describe('hidden factions and commendations', () => {
  it('stay in the editor lists, flagged', async () => {
    answers.organisations = [{ id: 1, name: 'Open', hidden: false }, { id: 2, name: 'Quiet', hidden: true }]
    answers.commendations = [{ id: 'x', name: 'Medal', description: '', hidden: true }]
    expect((await loadList('factions')).rows.map((r) => [r.name, r.hidden])).toEqual([['Open', false], ['Quiet', true]])
    expect((await loadList('commendations')).rows.map((r) => r.hidden)).toEqual([true])
  })
  it('show gear and system types by their label', async () => {
    answers.content_items = [{ id: 'g', pack_id: 1, draft: false, name: 'Light Hardsuit', type: 'Armor', source: null }]
    expect((await loadList('pilot_gear')).rows[0].facts).toBe('Armour')
    answers.content_items = [{ id: 's', pack_id: 1, draft: false, name: 'Sys', type: 'System', edited_id: null }]
    expect((await loadList('systems')).rows[0].facts).toBe('System')
    expect((await loadList('weapons')).rows[0].facts).toBe('System')
  })
  it('are left out of the award picker only', async () => {
    filters.length = 0
    await loadCommendations()
    expect(filters).toContainEqual(['commendations', 'hidden', false])
    filters.length = 0
    await loadList('commendations')
    expect(filters).not.toContainEqual(['commendations', 'hidden', false])
  })
})

describe('hidden items in a licence ladder', () => {
  it('are marked so no archive link points at nothing', () => {
    const frame = toFrame('f', { name: 'F', license_id: 'f', license_level: 1 })
    const unlocks = licenceUnlocks(frame, [toItem('a', { name: 'A', license_id: 'f', license_level: 1 }), toItem('b', { name: 'B', hidden: true, license_id: 'f', license_level: 1 })], [], [], 1)
    expect(unlocks.filter((u) => u.kind === 'weapon').map((u) => [u.name, !!u.hidden])).toEqual([['A', false], ['B', true]])
  })
})

describe('saveLine', () => {
  it('says who and when, or nothing without a stamp', () => {
    expect(saveLine('Ana', '2026-11-03T10:00:00Z')).toBe('Saved by Ana, 3 Nov 2026')
    expect(saveLine(null, '2026-11-03T10:00:00Z')).toBe('Saved by a former owner, 3 Nov 2026')
    expect(saveLine('Ana', null)).toBe('')
  })
})

// A guard, not proof: it catches a new picker file that forgot to filter hidden items, not a wrong filter.
describe('pickers hide hidden content', () => {
  const sources = import.meta.glob<string>(['./components/**/*.vue', './views/**/*.vue'], { query: '?raw', import: 'default', eager: true })
  const source = (file: string) => sources[`./${file}`]
  // The editor shows hidden items, flagged. The rest are shared components fed by filtered callers, or are not content lists.
  const exempt = (file: string) => file.startsWith('components/editor/') || ['RichTextEditor.vue', 'LoreEditView.vue', 'ItemPicker.vue', 'PickList.vue', 'LoadoutBox.vue'].some((name) => file.endsWith(`/${name}`))
  it('filter every picker with offered() or .hidden', () => {
    const files = Object.keys(sources).map((key) => key.slice(2)).filter((file) => !exempt(file) && /<(ItemPicker|PickList)\b/.test(source(file)))
    expect(files.length).toBeGreaterThan(0)
    expect(files.filter((file) => !/offered\(|\.hidden/.test(source(file)))).toEqual([])
  })
  it('filter the reputation list, and the award picker through its loader', () => {
    expect(source('components/ReputationPanel.vue')).toContain('hidden')
    expect(source('components/CommendationAward.vue')).toContain('loadCommendations')
  })
})
