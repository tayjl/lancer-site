import { describe, expect, it, vi } from 'vitest'
import { coreContent } from './coreContent'
import { packNames, sourceOf, tagDescriptions, tagNames, toItem, type Bionic, type CoreBonus, type Talent } from './gameData'
import { bionicInfo, coreBonusInfo, frameInfo, itemInfo, licenceInfo, manufacturerInfo, talentInfo, type Info, type Manufacturer } from './info'
import { licenceNames, type Frame } from './mechData'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))
const data = (id: string) => coreContent.items.find(item => item.id === id)!.data as Record<string, unknown>
const tags = coreContent.items.filter(item => item.kind === 'tags')
tagNames.value = new Map(tags.map(tag => [tag.id, String((tag.data as { name: string }).name)]))
tagDescriptions.value = new Map(tags.map(tag => [tag.id, String((tag.data as { description: string }).description)]))
licenceNames.value = new Map([['mf_goblin', 'HORUS Goblin']])
const headings = (info: Info, title: string) => info.groups.find(group => group.title === title)?.cards.map(card => card.heading)
const frame = (id: string): Frame => {
  const raw = data(id)
  return { id, name: String(raw.name), source: String(raw.source), licenceLevel: Number(raw.license_level), integrated: [], mechtype: raw.mechtype as string[], mounts: raw.mounts as string[], stats: raw.stats as Record<string, number>, description: String(raw.description), raw }
}

describe('full information', () => {
  it('shows a weapon with its licence, lore, actions and explained tags', () => {
    const info = itemInfo(toItem('mw_autopod', data('mw_autopod')))
    expect(info.kind).toBe('main launcher weapon')
    expect(info.id).toBe('mw_autopod')
    expect(info.facts).toEqual([{ text: 'HORUS' }, { text: 'Licence: HORUS Goblin I' }])
    expect(info.lore).toContain('antipersonnel weapon')
    expect(headings(info, 'rules')).toEqual(['effect', 'Autonomous Assault'])
    expect(info.groups[0].cards[1]).toMatchObject({ activation: 'Reaction', frequency: '1/round' })
    expect(info.groups[0].cards[1].html).toContain('<b>Trigger:</b>')
    expect(headings(info, 'tags')).toEqual(['seeking', 'unique'])
    expect(itemInfo(toItem('ms_turret_drones', data('ms_turret_drones'))).groups[1].cards.find(tag => tag.heading === 'limited 3')?.html).toContain('can only be used 3 times')
  })

  it('stacks a weapon’s rules', () => {
    const info = itemInfo(toItem('mw_concussion_missiles', data('mw_concussion_missiles')))
    expect(info.groups[0]).toMatchObject({ title: 'rules', stack: true })
    expect(info.groups[0].cards.some(card => card.heading === 'on hit')).toBe(true)
  })

  it('runs an item description’s paragraphs together', () => {
    const lore = itemInfo(toItem('mw_autopod', { ...data('mw_autopod'), description: 'One.<br>Two.<br/>Three.' })).lore
    expect(lore).toBe('One. Two. Three.')
  })

  it('treats pilot gear descriptions as rules when there is no effect', () => {
    const info = itemInfo(toItem('pg_camo_cloth', data('pg_camo_cloth')))
    expect(info.kind).toBe('pilot gear')
    expect(info.facts).toEqual([])
    expect(info.lore).toBe('')
    expect(headings(info, 'rules')).toEqual(['description'])
    expect(itemInfo(toItem('pg_corrective', data('pg_corrective'))).lore).toContain('plastic-like sheet')
  })

  it('shows a frame’s lore, stats against every frame, traits and core power', () => {
    const goblin = frame('mf_goblin'), everest = frame('mf_standard_pattern_i_everest')
    const info = frameInfo(goblin, [goblin, everest])
    expect(info).toMatchObject({ kind: 'HORUS frame', name: 'Goblin' })
    expect(info.facts[0]).toEqual({ text: 'Controller / Support' })
    expect(info.lore).toContain('first identified HORUS frame')
    expect(info.lore!.match(/<p>/g)).toHaveLength(3)
    expect(info.lore).not.toContain('<br>')
    expect(info.stats.find(stat => stat.label === 'size')).toMatchObject({ value: '½', range: { min: 0.5, max: 1, at: 0.5 } })
    expect(info.groups[0].title).toBeUndefined()
    expect(info.groups[0].cards.map(card => card.heading)).toEqual(['Liturgicode', 'Reactive Code', 'Fragile'])
    // Reactive Code's own reaction is the trait: shown once, with its chip.
    expect(info.groups[0].cards[1]).toMatchObject({ activation: 'Reaction', frequency: '1/round' })
    expect(info.groups[0].cards[1].html).toContain('<b>Trigger:</b>')
    const core = info.groups[1]
    expect(core.title).toBe('INSTINCT Rig')
    expect(core.cards.find(card => card.heading === 'Symbiosis')?.activation).toBe('Quick')
  })

  it('shows an action named like its trait or core power once, with the action’s chip and numbers', () => {
    const base = frame('mf_blackbeard')
    const raw = {
      ...base.raw,
      traits: [{
        name: 'Grapple Cable',
        description: 'The Blackbeard can Grapple.',
        active_effects: [{ name: 'Grapple cable', detail: 'You can Grapple targets within Range 5.' }],
        actions: [{ name: 'Reel In', activation: 'Quick', detail: 'Pull.' }],
      }],
      core_system: {
        name: 'Assault Grapples',
        active_name: 'Omni-harpoon',
        active_effect: 'Fires harpoons.',
        activation: 'Quick',
        active_actions: [{ name: 'Omni-harpoon', activation: 'Quick', trigger: 'You fire.', detail: 'Hull save or take 2d6 Kinetic.', range: [{ type: 'Burst', val: 5 }] }],
      },
    }
    const info = frameInfo({ ...base, raw })
    const [trait] = info.groups[0].cards
    expect(trait.heading).toBe('Grapple Cable')
    expect(trait.html).toContain('You can Grapple targets within Range 5.')
    expect(trait.html).not.toContain('The Blackbeard can Grapple.')
    expect(trait.html).not.toContain('Reel In')
    expect(trait.actions).toEqual([expect.objectContaining({ heading: 'Reel In', activation: 'Quick', html: 'Pull.' })])
    expect(info.groups.map(group => group.look)).toEqual(['traits', 'core'])
    const core = info.groups[1].cards
    expect(core.map(card => card.heading)).toEqual(['Omni-harpoon'])
    expect(core[0]).toMatchObject({ activation: 'Quick' })
    expect(core[0].html).toContain('<b>Trigger:</b> You fire.')
    expect(core[0].html).not.toContain('Fires harpoons.')
    expect(core[0].stats?.length).toBeGreaterThan(0)
  })

  it('shows every talent rank and core bonus text, with their summaries and lore', () => {
    const talent = talentInfo(data('t_ace') as unknown as Talent)
    expect(talent.lore).toContain('flight systems')
    expect(headings(talent, 'ranks')).toEqual(['rank I: Acrobatics', 'rank II: Afterburners', 'rank III: Supersonic'])
    const bonus = coreBonusInfo(data('cb_superior_by_design') as unknown as CoreBonus)
    expect(bonus.kind).toBe('HA core bonus')
    expect(headings(bonus, 'rules')).toEqual(['effect'])
  })

  it('shows bionic bonuses by stat name and escapes its plain text', () => {
    const bionic: Bionic = { id: 1, name: 'Eye', description: 'See <far> & wide', slot: 'Eyes', source: 'IPS-N', effect: '<p>Sees <b>far</b>.</p>', manna_cost: 750, mod_point_cost: 2, retired: false, bonuses: [{ stat_id: 'perception', amount: 1 }] }
    const info = bionicInfo(bionic, new Map([['perception', 'perception']]))
    expect(info.stats).toMatchObject([{ label: 'perception', value: '+1' }])
    expect(info.stats[0].icon).toBeTruthy()
    expect(info.facts.map(fact => fact.text)).toEqual(['IPS-N', 'Eyes', '2 mod points', '750 manna'])
    expect(info.groups[0].cards.map(card => card.heading)).toEqual(['effect'])
    expect(info.groups[0].cards[0].html).toBe('<p>Sees <b>far</b>.</p>')
    expect(info.lore).toBe('<p>See &lt;far> &amp; wide</p>')
  })
})

describe('pack names', () => {
  it('gives the pack an item came from, and nothing for an unknown id', () => {
    packNames.value = new Map([['mw_autopod', 'LANCER Core']])
    expect(sourceOf('mw_autopod')).toBe('LANCER Core')
    expect(sourceOf('nope')).toBe('')
  })
})

describe('archive information', () => {
  const frame = (id: string): Frame => {
    const raw = data(id)
    return { id, name: String(raw.name), source: String(raw.source), licenceLevel: Number(raw.license_level), integrated: [], mechtype: raw.mechtype as string[], mounts: raw.mounts as string[], stats: raw.stats as Record<string, number>, description: String(raw.description), raw }
  }
  it('shows a licence’s unlocks rank by rank', () => {
    const goblin = frame('mf_goblin')
    const items = (kind: string) => coreContent.items.filter(item => item.kind === kind).map(item => toItem(item.id, item.data))
    const info = licenceInfo(goblin, items('weapons'), items('systems'))
    expect(info).toMatchObject({ kind: 'HORUS licence', id: 'mf_goblin', name: 'Goblin' })
    expect(info.groups[0].cards.map(card => card.heading)).toEqual(['rank I', 'rank II', 'rank III'])
    expect(info.groups[0].cards[0].unlocks).toContainEqual(expect.objectContaining({ kind: 'weapon', name: 'Autopod', to: { name: 'archives', query: { cat: 'mech weapons', item: 'mech weapons:mw_autopod' } } }))
    // The frame itself is at rank II, and links to its own entry.
    expect(info.groups[0].cards[1].unlocks).toContainEqual(expect.objectContaining({ kind: 'frame', name: 'Goblin', to: { name: 'archives', query: { cat: 'frames', item: 'frames:mf_goblin' } } }))
  })

  it('shows a manufacturer’s motto, history and frames', () => {
    const ipsn = data('IPS-N') as unknown as Manufacturer
    const info = manufacturerInfo(ipsn, [frame('mf_blackbeard'), frame('mf_goblin')])
    expect(info).toMatchObject({ kind: 'manufacturer', id: 'IPS-N', name: 'IPS-NORTHSTAR' })
    expect(info.lore).toContain('Your friend in an unfriendly sea')
    expect(info.groups[0].cards.map(card => card.heading)).toEqual(['Blackbeard'])
  })
})
