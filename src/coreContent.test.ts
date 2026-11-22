import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { coreContent } from './coreContent'
import { coreNeedsUpdate, hasCoreContent, LCP_KINDS, readLcp } from './lcp'

const installed = coreContent.items.map(item => ({ id: item.id, kind: item.kind, pack_id: 1 }))

describe('official core content', () => {
  it('recognises the real core dataset and legacy data split between packs', () => {
    expect(hasCoreContent([])).toBe(false)
    expect(hasCoreContent(installed)).toBe(true)
    expect(hasCoreContent(installed.map((item, i) => ({ ...item, pack_id: i % 2 + 1 })))).toBe(true)
    expect(hasCoreContent(installed.filter(item => item.kind !== 'pilot_gear'))).toBe(false)
  })

  it('offers a core update only when core exists and some seed item is missing', () => {
    const ids = coreContent.items.map(item => item.id)
    const withoutActions = installed.filter(item => item.kind !== 'actions')
    expect(coreNeedsUpdate([], ids)).toBe(false)
    expect(coreNeedsUpdate(withoutActions, ids)).toBe(true)
    expect(coreNeedsUpdate(installed, ids)).toBe(false)
    expect(coreNeedsUpdate(installed, [...ids, 'act_brand_new'])).toBe(true)
    expect(coreNeedsUpdate(installed, [])).toBe(false)
  })

  it('words Overkill and Knockback for the campaign', () => {
    const tag = (id: string) => String(coreContent.items.find(item => item.id === id)!.data.description)
    expect(tag('tg_overkill')).toBe('Before an attack you can take 1 Heat to add +2 damage, once per attack.')
    expect(tag('tg_knockback')).toMatch(/full hit or crit/)
    expect(tag('tg_reliable')).toMatch(/^This weapon has some degree/)
  })

  it('does not include missing-data placeholders', () => {
    expect(coreContent.items.length).toBeGreaterThan(200)
    expect(coreContent.items.some(item => item.id.startsWith('missing_'))).toBe(false)
  })

  it('passes the same validation as an uploaded LCP', async () => {
    const files = {
      'lcp_manifest.json': strToU8(JSON.stringify(coreContent.manifest)),
      ...Object.fromEntries(Object.keys(LCP_KINDS).filter(kind => kind !== 'actions' && kind !== 'rules').map(kind => [`${kind}.json`, strToU8(JSON.stringify(coreContent.items.filter(item => item.kind === kind).map(item => item.data)))])),
    }
    const parsed = await readLcp(zipSync(files))
    expect(parsed.items).toEqual(coreContent.items.filter(item => item.kind !== 'actions' && item.kind !== 'rules'))
    expect(parsed.manifest.version).toBe('3.1.7')
  })
})
