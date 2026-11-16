import { describe, expect, it, vi } from 'vitest'
import { toItem } from './gameData'
import { activationOf, cardRules, itemCard, itemFacts, itemRules } from './itemDetails'
import { licenceNames } from './mechData'

vi.mock('./lib/supabaseClient', () => ({ supabase: {} }))

describe('item cards', () => {
  it('colours and marks each kind of item', () => {
    expect(itemCard(toItem('a', { mount: 'Main', type: 'Melee' }))).toEqual({ type: 'weapon', icon: 'melee' })
    expect(itemCard(toItem('b', { type: 'Weapon' }))).toEqual({ type: 'weapon', icon: 'weapon' })
    expect(itemCard(toItem('c', { type: 'Deployable', tags: [{ id: 'tg_grenade' }] }))).toEqual({ type: 'system', icon: 'grenade' })
    expect(itemCard(toItem('d', { type: 'AI' }))).toEqual({ type: 'system', icon: 'system' })
    expect(itemCard(toItem('e', { type: 'Armor' }))).toEqual({ type: 'pilot', icon: 'generic_item' })
  })

  it('names the licence rank, or the maker, then the mount and type', () => {
    licenceNames.value = new Map([['mf_blackbeard', 'IPS-N Blackbeard']])
    expect(itemFacts(toItem('a', { source: 'IPS-N', license_id: 'mf_blackbeard', license_level: 2, mount: 'Main', type: 'Melee' }))).toEqual(['IPS-N Blackbeard II', 'Main Melee'])
    expect(itemFacts(toItem('b', { source: 'GMS', type: 'System' }))).toEqual(['GMS'])
    expect(itemFacts(toItem('c', { type: 'Gear' }))).toEqual([])
  })

  it('maps activations to their chips, and passive ones to none', () => {
    expect(activationOf('Quick Tech')).toEqual({ colour: 'tech', icon: 'tech_quick' })
    expect(activationOf('Free')).toEqual({ colour: 'free', icon: 'free_action' })
    expect(activationOf('None')).toBeNull()
  })

  it('keeps an action’s activation, frequency, range and damage apart from its name', () => {
    const [action] = itemRules({ actions: [{ name: 'Throw', activation: 'Quick', frequency: '1/Round', range: [{ type: 'Range', val: 5 }], damage: [{ type: 'Explosive', val: '1d6' }], detail: 'Boom.' }] })
    expect(action).toMatchObject({ name: 'Throw', activation: 'Quick', frequency: '1/round', text: 'Boom.' })
    expect(action.stats.map((stat) => `${stat.kind} ${stat.label} ${stat.value}`)).toEqual(['range range 5', 'damage explosive 4'])
  })

  it('leaves active effects off cards unless they are the item’s only rules', () => {
    const effect = { name: 'Paint', detail: 'Scratched.' }
    expect(cardRules(toItem('a', { type: 'System', effect: 'Roll 1d6.', active_effects: [effect] }))).toEqual([])
    expect(cardRules(toItem('b', { type: 'System', active_effects: [effect] })).map((rule) => rule.text)).toEqual(['Scratched.'])
  })
})
