import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { planLcp, readLcp, type InstalledPack } from './lcp'

const manifest = { name: 'Test pack', author: 'Test author', version: '1.0.0', description: 'Test content.' }
const archive = (files: Record<string, unknown> = {}) => zipSync(Object.fromEntries(Object.entries({
  'lcp_manifest.json': manifest,
  'frames.json': [{ id: 'test_frame', name: 'Test Frame', stats: { hp: 10 } }],
  ...files,
}).map(([name, value]) => [name, strToU8(JSON.stringify(value))])))

describe('LCP files', () => {
  it('reads root content, preserving item data and reporting unused files', async () => {
    const pack = await readLcp(archive({ 'nested/weapons.json': [{ id: 'ignored', name: 'Ignored' }], 'npc_classes.json': [] }))
    expect(pack.manifest.name).toBe('Test pack')
    expect(pack.items).toEqual([{ id: 'test_frame', kind: 'frames', data: { id: 'test_frame', name: 'Test Frame', stats: { hp: 10 } } }])
    expect(pack.ignored).toEqual(['nested/weapons.json', 'npc_classes.json'])
  })

  it('requires the manifest at the archive root', async () => {
    await expect(readLcp(zipSync({ 'folder/lcp_manifest.json': strToU8(JSON.stringify(manifest)) }))).rejects.toThrow('Missing lcp_manifest.json')
  })

  it.each([
    [{ 'lcp_manifest.json': { ...manifest, name: '' } }, 'name'],
    [{ 'lcp_manifest.json': { ...manifest, version: 'latest' } }, 'version'],
    [{ 'frames.json': {} }, 'list of items'],
    [{ 'frames.json': [{ name: 'No ID' }] }, 'non-empty ID'],
    [{ 'frames.json': [{ id: 'test', name: '' }] }, 'needs a name'],
    [{ 'weapons.json': [{ id: 'test_frame', name: 'Duplicate' }] }, 'Duplicate item ID'],
    [{ 'frames.json': [] }, 'no supported'],
  ])('rejects invalid content', async (files, message) => {
    await expect(readLcp(archive(files as Record<string, unknown>))).rejects.toThrow(message as string)
  })

  it('rejects malformed JSON and invalid archives', async () => {
    await expect(readLcp(zipSync({ 'lcp_manifest.json': strToU8('{broken') }))).rejects.toThrow('not valid UTF-8 JSON')
    await expect(readLcp(new Uint8Array([1, 2, 3]))).rejects.toThrow('valid .lcp file')
  })

  it('limits expanded file sizes before decompression', async () => {
    const data = zipSync({ 'lcp_manifest.json': strToU8(' '.repeat(8 * 1024 * 1024 + 1)) })
    await expect(readLcp(data)).rejects.toThrow('JSON content is too large')
  })

  it('warns about dependencies and advanced v3 effects', async () => {
    const pack = await readLcp(archive({ 'lcp_manifest.json': { ...manifest, v3: true, dependencies: [{ name: 'Another pack', version: '1.0.0' }] } }))
    expect(pack.warnings).toHaveLength(2)
  })
})

describe('LCP preview', () => {
  const packs = [{ id: 1, name: 'Test pack' }, { id: 2, name: 'Other pack' }] as InstalledPack[]
  it('counts additions, updates and items retained for existing pilots', async () => {
    const pack = await readLcp(archive({ 'weapons.json': [{ id: 'new_weapon', name: 'New weapon' }] }))
    expect(planLcp(pack, packs, [
      { id: 'test_frame', kind: 'frames', pack_id: 1 },
      { id: 'old_weapon', kind: 'weapons', pack_id: 1 },
    ])).toMatchObject({ added: 1, updated: 1, retained: 1, conflicts: [] })
  })

  it('blocks IDs owned by another pack and existing IDs changing type', async () => {
    const pack = await readLcp(archive())
    expect(planLcp(pack, packs, [{ id: 'test_frame', kind: 'frames', pack_id: 2 }]).conflicts[0]?.reason).toContain('Other pack')
    expect(planLcp(pack, packs, [{ id: 'test_frame', kind: 'weapons', pack_id: 1 }]).conflicts[0]?.reason).toContain('change the item type')
  })
})
