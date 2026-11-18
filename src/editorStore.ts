import { HOMEBREW_PACK, KINDS, isObject, type Data, type EditorKind } from './contentEditor'
import type { Json } from './lib/database.types'
import { LCP_KINDS, writeLcp, type LcpKind } from './lcp'
import { CHANGED_ELSEWHERE, checkWrite, fetchAll, supabase } from './lib/supabaseClient'

// The content editor's reads and writes (ContentEditorView.vue). Every write ends in .select() through checkWrite(),
// and changes to a row it already has are guarded with the updated_at it loaded (so a newer save elsewhere is never
// overwritten), as on the pilot sheet. Callers show the error text as "Not saved: ..." and clear the game-content
// cache (invalidateCatalogues) after a write that worked.

export type Pack = { id: number; name: string; manifest: Json }
// One row of the list: just enough to show and find it.
export type ListRow = { key: string; kind: EditorKind; name: string; facts: string; packId: number | null; draft: boolean; edited: boolean }
// One item in full. "data" is the pack's own version (a bionic's or a personal stat's row as an object); "edited" the
// campaign's edited version when there is one. "updatedAt" is the raw string the page last loaded or saved.
export type Loaded = { key: string; kind: EditorKind; packId: number | null; draft: boolean; data: Data; edited: Data | null; updatedAt: string }
type Saved = { updatedAt: string; error?: undefined } | { error: string; updatedAt?: undefined }

const message = (error: unknown) => String((error as { message?: string })?.message ?? error)

export async function loadPacks(): Promise<{ packs: Pack[]; error: string | null }> {
  const { data, error } = await supabase.from('content_packs').select('id, name, manifest').order('name')
  return error ? { packs: [], error: error.message } : { packs: data ?? [], error: null }
}

// The personal stats (bionic bonuses point at them), and every item id in use (a new id must be unused: they're one
// namespace across every kind and pack).
export async function loadStats(): Promise<{ id: string; name: string }[]> {
  const { rows } = await fetchAll((from, to) => supabase.from('pilot_stats').select('id, name').order('sort_order').order('id').range(from, to))
  return rows
}
export async function loadIds(): Promise<Set<string>> {
  const { rows } = await fetchAll((from, to) => supabase.from('content_items').select('id').order('id').range(from, to))
  return new Set(rows.map((row) => row.id))
}

// How many of each kind there are (drafts too), for the tabs.
export async function loadCounts(): Promise<Record<string, number>> {
  const counts = await Promise.all(KINDS.map(async ({ key }) => {
    const query = key === 'bionics' ? supabase.from('bionics').select('id', { count: 'exact', head: true })
      : key === 'pilot_stats' ? supabase.from('pilot_stats').select('id', { count: 'exact', head: true })
      : supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('kind', key)
    return [key, (await query).count ?? 0] as const
  }))
  return Object.fromEntries(counts)
}

// What each kind's list shows. Pack items read just a few fields (the rows are big); bionics and stats are small tables.
export async function loadList(kind: EditorKind): Promise<{ rows: ListRow[]; error: string | null }> {
  if (kind === 'bionics') {
    const { rows, error } = await fetchAll((from, to) => supabase.from('bionics').select('id, name, slot, manna_cost, mod_point_cost, retired').order('name').order('id').range(from, to))
    return { rows: rows.map((b) => ({ key: String(b.id), kind, name: b.name, facts: [b.slot, `${b.mod_point_cost} mod ${b.mod_point_cost === 1 ? 'point' : 'points'}`, `${b.manna_cost} manna`, b.retired ? 'retired' : ''].filter(Boolean).join(' · '), packId: null, draft: false, edited: false })), error }
  }
  if (kind === 'pilot_stats') {
    const { rows, error } = await fetchAll((from, to) => supabase.from('pilot_stats').select('id, name').order('sort_order').order('id').range(from, to))
    return { rows: rows.map((s) => ({ key: s.id, kind, name: s.name, facts: s.id, packId: null, draft: false, edited: false })), error }
  }
  const { rows, error } = await fetchAll((from, to) =>
    supabase.from('content_items')
      .select('id, pack_id, draft, name:data->>name, edited_name:edited->>name, type:data->>type, mount:data->>mount, source:data->>source, edited_id:edited->>id')
      .eq('kind', kind).order('id').range(from, to))
  return {
    rows: rows.map((row) => {
      const r = row as unknown as { id: string; pack_id: number; draft: boolean; name: string | null; edited_name: string | null; type: string | null; mount: string | null; source: string | null; edited_id: string | null }
      return { key: r.id, kind, name: r.edited_name ?? r.name ?? r.id, facts: [r.mount, r.type, r.source].filter(Boolean).join(' · '), packId: r.pack_id, draft: r.draft, edited: r.edited_id !== null }
    }),
    error,
  }
}

export async function loadItem(kind: EditorKind, key: string): Promise<{ item: Loaded | null; error: string | null }> {
  if (kind === 'bionics') {
    const { data, error } = await supabase.from('bionics').select('*, bonuses:bionic_bonuses(stat_id, amount)').eq('id', Number(key)).maybeSingle()
    if (error || !data) return { item: null, error: error?.message ?? null }
    const { updated_at, bonuses, ...rest } = data
    const bonusList = [...bonuses].sort((a, b) => a.stat_id.localeCompare(b.stat_id))
    return { item: { key, kind, packId: null, draft: false, edited: null, updatedAt: updated_at, data: { id: String(data.id), name: rest.name, description: rest.description ?? '', slot: rest.slot, effect: rest.effect, manna_cost: rest.manna_cost, mod_point_cost: rest.mod_point_cost, retired: rest.retired, bonuses: bonusList } }, error: null }
  }
  if (kind === 'pilot_stats') {
    const { data, error } = await supabase.from('pilot_stats').select('*').eq('id', key).maybeSingle()
    if (error || !data) return { item: null, error: error?.message ?? null }
    return { item: { key, kind, packId: null, draft: false, edited: null, updatedAt: data.updated_at, data: { id: data.id, name: data.name, sort_order: data.sort_order } }, error: null }
  }
  const { data, error } = await supabase.from('content_items').select('id, pack_id, draft, data, edited, updated_at').eq('id', key).maybeSingle()
  if (error || !data) return { item: null, error: error?.message ?? null }
  return {
    item: { key, kind, packId: data.pack_id, draft: data.draft, data: isObject(data.data) ? data.data : {}, edited: isObject(data.edited) ? data.edited : null, updatedAt: data.updated_at },
    error: null,
  }
}

// The pack new items go in: made the first time an owner makes an item (or found, if another owner just did).
export async function homebrewPack(packs: Pack[]): Promise<{ id: number; error?: undefined } | { error: string; id?: undefined }> {
  const have = packs.find((pack) => pack.name === HOMEBREW_PACK)
  if (have) return { id: have.id }
  const manifest = { name: HOMEBREW_PACK, author: 'Campaign owners', version: '1.0.0', description: "Items made in the site's content editor." }
  const made = await checkWrite(await supabase.from('content_packs').insert({ name: HOMEBREW_PACK, version: '1.0.0', manifest }).select('id'))
  if (made.row) return { id: made.row.id }
  const again = await supabase.from('content_packs').select('id').eq('name', HOMEBREW_PACK).maybeSingle()
  return again.data ? { id: again.data.id } : { error: made.error }
}

// What save_bionic takes, from the form data (the slot is trimmed by the function).
const bionicArgs = (working: Data) => ({ new_name: String(working.name), new_description: String(working.description ?? ''), new_slot: String(working.slot ?? ''), new_effect: String(working.effect ?? ''), new_price: Number(working.manna_cost), new_mod_cost: Number(working.mod_point_cost), new_retired: !!working.retired, new_bonuses: (working.bonuses ?? []) as Json })

// A new item, as a draft (pack items), or a new bionic or personal stat.
export async function createItem(kind: EditorKind, working: Data, packId: number | null): Promise<(Saved & { key?: string })> {
  if (kind === 'bionics') {
    const { data, error } = await supabase.rpc('save_bionic', bionicArgs(working))
    const saved = data as { id: number; updated_at: string } | null
    return error || !saved ? { error: error ? message(error) : 'The bionic was not saved.' } : { updatedAt: saved.updated_at, key: String(saved.id) }
  }
  if (kind === 'pilot_stats') {
    const result = await checkWrite(await supabase.from('pilot_stats').insert({ id: String(working.id), name: String(working.name), sort_order: Number(working.sort_order) }).select('updated_at'))
    return result.error !== null ? { error: result.error } : { updatedAt: result.row.updated_at, key: String(working.id) }
  }
  const result = await checkWrite(await supabase.from('content_items').insert({ id: String(working.id), pack_id: packId!, kind, data: working as Json, draft: true }).select('updated_at'))
  return result.error !== null ? { error: result.error } : { updatedAt: result.row.updated_at, key: String(working.id) }
}

// Saves what's on screen over the loaded item: a homebrew item's own data, or an imported item's edited version.
export async function saveItem(item: Loaded, working: Data, homebrew: boolean): Promise<Saved> {
  const seen = item.updatedAt
  if (item.kind === 'bionics') {
    const { data, error } = await supabase.rpc('save_bionic', { ...bionicArgs(working), target_id: Number(item.key), expected_updated_at: seen })
    const saved = data as { updated_at: string } | null
    if (error) return { error: /changed somewhere else/.test(error.message) ? CHANGED_ELSEWHERE : message(error) }
    return saved ? { updatedAt: saved.updated_at } : { error: 'The bionic was not saved.' }
  }
  if (item.kind === 'pilot_stats') {
    const result = await checkWrite(
      await supabase.from('pilot_stats').update({ name: String(working.name), sort_order: Number(working.sort_order) }).eq('id', item.key).eq('updated_at', seen).select('updated_at'),
      { seen, recheck: () => supabase.from('pilot_stats').select('updated_at').eq('id', item.key).maybeSingle() },
    )
    return result.error !== null ? { error: result.error } : { updatedAt: result.row.updated_at }
  }
  return update(item, homebrew ? { data: working as Json } : { edited: working as Json })
}

// Publishing a draft, or putting an edited import back to the pack's own version (edited = null).
export const publishItem = (item: Loaded) => update(item, { draft: false })
export const revertItem = (item: Loaded) => update(item, { edited: null })

async function update(item: Loaded, changes: { data?: Json; edited?: Json | null; draft?: boolean }): Promise<Saved> {
  const seen = item.updatedAt
  const result = await checkWrite(
    await supabase.from('content_items').update(changes).eq('id', item.key).eq('updated_at', seen).select('updated_at'),
    { seen, recheck: () => supabase.from('content_items').select('updated_at').eq('id', item.key).maybeSingle() },
  )
  return result.error !== null ? { error: result.error } : { updatedAt: result.row.updated_at }
}

// Only homebrew items can be deleted, and only while no pilot uses them (the database says so too).
export async function deleteItem(key: string): Promise<string | null> {
  const { error } = await supabase.rpc('delete_content_item', { target_id: key })
  return error ? message(error) : null
}

// The pilots using an item, each named once, in their sheet or an open change.
export async function usageOf(kind: EditorKind, key: string): Promise<{ pilots: string[]; error: string | null }> {
  const { data, error } = await supabase.rpc('item_usage', { item_id: key, is_bionic: kind === 'bionics' })
  return error ? { pilots: [], error: error.message } : { pilots: [...new Set((data ?? []).map((row) => row.pilot))].sort(), error: null }
}

// The Campaign homebrew pack's published items as an .lcp, for backing up or sharing. Drafts are left out.
export async function exportHomebrew(): Promise<{ bytes: Uint8Array; filename: string; count: number } | { error: string }> {
  const pack = await supabase.from('content_packs').select('id, manifest').eq('name', HOMEBREW_PACK).maybeSingle()
  if (pack.error) return { error: pack.error.message }
  if (!pack.data) return { error: 'There is no homebrew yet: make an item first.' }
  const { rows, error } = await fetchAll((from, to) => supabase.from('content_items').select('id, kind, data').eq('pack_id', pack.data!.id).eq('draft', false).order('id').range(from, to))
  if (error) return { error }
  const items = rows.flatMap((row) => (Object.hasOwn(LCP_KINDS, row.kind) ? [{ kind: row.kind as LcpKind, data: row.data }] : []))
  if (!items.length) return { error: 'There are no published homebrew items to export yet.' }
  const manifest = pack.data.manifest as Record<string, Json>
  return { bytes: writeLcp(manifest, items), filename: `${HOMEBREW_PACK.toLowerCase().replaceAll(' ', '-')}-${String(manifest.version ?? '1.0.0')}.lcp`, count: items.length }
}
