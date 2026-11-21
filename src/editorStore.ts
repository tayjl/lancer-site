import { HOMEBREW_PACK, KINDS, isObject, withExoticTag, type Data, type EditorKind } from './contentEditor'
import type { Json } from './lib/database.types'
import { LCP_KINDS, writeLcp, type LcpKind } from './lcp'
import { CHANGED_ELSEWHERE, NOT_ALLOWED, checkWrite, fetchAll, supabase } from './lib/supabaseClient'
import { plural } from './text'

// The content editor's reads and writes (ContentEditorView.vue). Every write ends in .select() through checkWrite(),
// and changes to a row it already has are guarded with the updated_at it loaded (so a newer save elsewhere is never
// overwritten), as on the pilot sheet. Callers show the error text as "Not saved: ..." and clear the game-content
// cache (invalidateCatalogues) after a write that worked.

export type Pack = { id: number; name: string; manifest: Json }
// One row of the list: just enough to show and find it.
export type ListRow = { key: string; kind: EditorKind; name: string; facts: string; packId: number | null; draft: boolean; edited: boolean; source?: string }
// One item in full. "data" is the pack's own version (a bionic's or a personal stat's row as an object); "edited" the
// campaign's edited version when there is one. "updatedAt" is the raw string the page last loaded or saved.
export type Loaded = { key: string; kind: EditorKind; packId: number | null; draft: boolean; data: Data; edited: Data | null; updatedAt: string }
export type Saved = { updatedAt: string; error?: undefined } | { error: string; updatedAt?: undefined }

export const message = (error: unknown) => String((error as { message?: string })?.message ?? error)

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
      : key === 'factions' ? supabase.from('organisations').select('id', { count: 'exact', head: true })
      : key === 'commendations' ? supabase.from('commendations').select('id', { count: 'exact', head: true })
      : supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('kind', key)
    return [key, (await query).count ?? 0] as const
  }))
  return Object.fromEntries(counts)
}

// Kinds the list boxes by manufacturer (the box says it, so the row doesn't).
const MAKER_KINDS: EditorKind[] = ['frames', 'weapons', 'systems', 'mods', 'core_bonuses']
// What each kind's list shows. Pack items read just a few fields (the rows are big); bionics are a small table.
export async function loadList(kind: EditorKind): Promise<{ rows: ListRow[]; error: string | null }> {
  if (kind === 'bionics') {
    const { rows, error } = await fetchAll((from, to) => supabase.from('bionics').select('id, name, slot, source, manna_cost, mod_point_cost, retired').order('name').order('id').range(from, to))
    return { rows: rows.map((b) => ({ key: String(b.id), kind, name: b.name, facts: [b.slot, plural(b.mod_point_cost, 'mod point'), `${b.manna_cost} manna`, b.retired ? 'Retired' : ''].filter(Boolean).join(' · '), packId: null, draft: false, edited: false, source: b.source ?? '' })), error }
  }
  if (kind === 'factions') {
    const { rows, error } = await fetchAll((from, to) => supabase.from('organisations').select('id, name').order('name').order('id').range(from, to))
    return { rows: rows.map((f) => ({ key: String(f.id), kind, name: f.name, facts: '', packId: null, draft: false, edited: false })), error }
  }
  if (kind === 'commendations') {
    const { rows, error } = await fetchAll((from, to) => supabase.from('commendations').select('id, name, description').order('name').order('id').range(from, to))
    return { rows: rows.map((c) => ({ key: c.id, kind, name: c.name, facts: c.description, packId: null, draft: false, edited: false })), error }
  }
  const { rows, error } = await fetchAll((from, to) =>
    supabase.from('content_items')
      .select('id, pack_id, draft, name:data->>name, edited_name:edited->>name, type:data->>type, mount:data->>mount, source:data->>source, edited_source:edited->>source, edited_id:edited->>id')
      .eq('kind', kind).order('id').range(from, to))
  return {
    rows: rows.map((row) => {
      const r = row as unknown as { id: string; pack_id: number; draft: boolean; name: string | null; edited_name: string | null; type: string | null; mount: string | null; source: string | null; edited_source: string | null; edited_id: string | null }
      return { key: r.id, kind, name: r.edited_name ?? r.name ?? r.id, facts: [r.mount, r.type, ...(MAKER_KINDS.includes(kind) ? [] : [r.source])].filter(Boolean).join(' · '), packId: r.pack_id, draft: r.draft, edited: r.edited_id !== null, source: r.edited_source ?? r.source ?? '' }
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
    return { item: { key, kind, packId: null, draft: false, edited: null, updatedAt: updated_at, data: { id: String(data.id), name: rest.name, description: rest.description ?? '', slot: rest.slot, source: rest.source ?? '', effect: rest.effect, manna_cost: rest.manna_cost, mod_point_cost: rest.mod_point_cost, retired: rest.retired, bonuses: bonusList } }, error: null }
  }
  if (kind === 'factions') {
    const { data, error } = await supabase.from('organisations').select('id, name, updated_at').eq('id', Number(key)).maybeSingle()
    if (error || !data) return { item: null, error: error?.message ?? null }
    return { item: { key, kind, packId: null, draft: false, edited: null, updatedAt: data.updated_at, data: { id: key, name: data.name } }, error: null }
  }
  if (kind === 'commendations') {
    const { data, error } = await supabase.from('commendations').select('id, name, description, icon, updated_at').eq('id', key).maybeSingle()
    if (error || !data) return { item: null, error: error?.message ?? null }
    return { item: { key, kind, packId: null, draft: false, edited: null, updatedAt: data.updated_at, data: { id: data.id, name: data.name, description: data.description, icon: data.icon } }, error: null }
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
const ids = (value: unknown) => (Array.isArray(value) ? value.map(String) : [])
const bionicArgs = (working: Data) => ({ new_name: String(working.name), new_description: String(working.description ?? ''), new_slot: String(working.slot ?? ''), new_source: String(working.source ?? ''), new_effect: String(working.effect ?? ''), new_price: Number(working.manna_cost), new_mod_cost: Number(working.mod_point_cost), new_retired: !!working.retired, new_bonuses: (working.bonuses ?? []) as Json,
  new_effect_bonuses: (Array.isArray(working.effect_bonuses) ? working.effect_bonuses : []) as Json, new_integrated: ids(working.integrated), new_special_equipment: ids(working.special_equipment), new_replace_integrated: working.replace_integrated === true, new_requires: (Array.isArray(working.requires) ? working.requires : []) as Json })

// A new item, as a draft (pack items), or a new bionic.
export async function createItem(kind: EditorKind, edits: Data, packId: number | null): Promise<(Saved & { key?: string })> {
  const working = withExoticTag(kind, edits)
  if (kind === 'bionics') {
    const { data, error } = await supabase.rpc('save_bionic', bionicArgs(working))
    const saved = data as { id: number; updated_at: string } | null
    return error || !saved ? { error: error ? message(error) : NOT_ALLOWED } : { updatedAt: saved.updated_at, key: String(saved.id) }
  }
  const result = await checkWrite(await supabase.from('content_items').insert({ id: String(working.id), pack_id: packId!, kind, data: working as Json, draft: true }).select('updated_at'))
  return result.error !== null ? { error: result.error } : { updatedAt: result.row.updated_at, key: String(working.id) }
}

// Saves what's on screen over the loaded item: a homebrew item's own data, or an imported item's edited version.
export async function saveItem(item: Loaded, edits: Data, homebrew: boolean): Promise<Saved> {
  const working = withExoticTag(item.kind, edits)
  const seen = item.updatedAt
  if (item.kind === 'bionics') {
    const { data, error } = await supabase.rpc('save_bionic', { ...bionicArgs(working), target_id: Number(item.key), expected_updated_at: seen })
    const saved = data as { updated_at: string } | null
    if (error) return { error: /changed somewhere else/.test(error.message) ? CHANGED_ELSEWHERE : message(error) }
    return saved ? { updatedAt: saved.updated_at } : { error: NOT_ALLOWED }
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

// Factions: just a name (the reputation tracker's organisations). Deleting one removes every pilot's reputation with it.
export async function createFaction(name: string): Promise<{ updatedAt: string; key: string; error?: undefined } | { error: string; updatedAt?: undefined; key?: undefined }> {
  const result = await checkWrite(await supabase.from('organisations').insert({ name: name.trim() }).select('id, updated_at'))
  return result.error !== null ? { error: result.error } : { updatedAt: result.row.updated_at, key: String(result.row.id) }
}
export async function saveFaction(item: Loaded, name: string): Promise<Saved> {
  const seen = item.updatedAt
  const id = Number(item.key)
  const result = await checkWrite(
    await supabase.from('organisations').update({ name: name.trim() }).eq('id', id).eq('updated_at', seen).select('updated_at'),
    { seen, recheck: () => supabase.from('organisations').select('updated_at').eq('id', id).maybeSingle() },
  )
  return result.error !== null ? { error: result.error } : { updatedAt: result.row.updated_at }
}
export async function deleteFaction(key: string): Promise<string | null> {
  return (await checkWrite(await supabase.from('organisations').delete().eq('id', Number(key)).select('id'))).error
}

// Commendations: a name, a description and an icon. Deleting one takes it from every pilot who has it.
export type CommendationFields = { name: string; description: string; icon: string }
export async function createCommendation(fields: CommendationFields): Promise<{ updatedAt: string; key: string; error?: undefined } | { error: string; updatedAt?: undefined; key?: undefined }> {
  const result = await checkWrite(await supabase.from('commendations').insert({ ...fields, name: fields.name.trim() }).select('id, updated_at'))
  return result.error !== null ? { error: result.error } : { updatedAt: result.row.updated_at, key: result.row.id }
}
export async function saveCommendation(item: Loaded, fields: CommendationFields): Promise<Saved> {
  const seen = item.updatedAt
  const result = await checkWrite(
    await supabase.from('commendations').update({ ...fields, name: fields.name.trim() }).eq('id', item.key).eq('updated_at', seen).select('updated_at'),
    { seen, recheck: () => supabase.from('commendations').select('updated_at').eq('id', item.key).maybeSingle() },
  )
  return result.error !== null ? { error: result.error } : { updatedAt: result.row.updated_at }
}
export async function deleteCommendation(key: string): Promise<string | null> {
  return (await checkWrite(await supabase.from('commendations').delete().eq('id', key).select('id'))).error
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
  if (!pack.data) return { error: 'No homebrew yet.' }
  const { rows, error } = await fetchAll((from, to) => supabase.from('content_items').select('id, kind, data').eq('pack_id', pack.data!.id).eq('draft', false).order('id').range(from, to))
  if (error) return { error }
  const items = rows.flatMap((row) => (Object.hasOwn(LCP_KINDS, row.kind) ? [{ kind: row.kind as LcpKind, data: row.data }] : []))
  if (!items.length) return { error: 'No published homebrew to export.' }
  const manifest = pack.data.manifest as Record<string, Json>
  return { bytes: writeLcp(manifest, items), filename: `${HOMEBREW_PACK.toLowerCase().replaceAll(' ', '-')}-${String(manifest.version ?? '1.0.0')}.lcp`, count: items.length }
}
