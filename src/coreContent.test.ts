import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { coreContent } from './coreContent'
import { hasCoreContent, LCP_KINDS, readLcp } from './lcp'

const installed = coreContent.items.map(item => ({ id: item.id, kind: item.kind, pack_id: 1 }))

describe('official core content', () => {
  it('recognises the real core dataset and legacy data split between packs', () => {
    expect(hasCoreContent([])).toBe(false)
    expect(hasCoreContent(installed)).toBe(true)
    expect(hasCoreContent(installed.map((item, i) => ({ ...item, pack_id: i % 2 + 1 })))).toBe(true)
    expect(hasCoreContent(installed.filter(item => item.kind !== 'pilot_gear'))).toBe(false)
  })

  it('does not include missing-data placeholders', () => {
    expect(coreContent.items.length).toBeGreaterThan(200)
    expect(coreContent.items.some(item => item.id.startsWith('missing_'))).toBe(false)
  })

  it('passes the same validation as an uploaded LCP', async () => {
    const files = {
      'lcp_manifest.json': strToU8(JSON.stringify(coreContent.manifest)),
      ...Object.fromEntries(Object.keys(LCP_KINDS).map(kind => [`${kind}.json`, strToU8(JSON.stringify(coreContent.items.filter(item => item.kind === kind).map(item => item.data)))])),
    }
    const parsed = await readLcp(zipSync(files))
    expect(parsed.items).toEqual(coreContent.items)
    expect(parsed.manifest.version).toBe('3.1.7')
  })
})
