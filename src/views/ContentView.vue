<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { isOwner, profile } from '../auth'
import PageHeader from '../components/PageHeader.vue'
import FileSection from '../components/FileSection.vue'
import { readError, supabase } from '../lib/supabaseClient'
import { loadContentIndex } from '../catalogue'
import type { Json } from '../lib/database.types'
import { invalidateCatalogues } from '../gameData'
import { confirmAction } from '../confirm'
import { LCP_KINDS, MAX_LCP_BYTES, coreNeedsUpdate, hasCoreContent, plainPackText, planLcp, readLcp, type InstalledItem, type InstalledPack, type LcpPack } from '../lcp'
import { message } from '../editorStore'
import { plural } from '../text'
import { formatDate } from '../time'

// Preview locally, then save the complete pack with one owner-only database call.
const packs = shallowRef<InstalledPack[]>([])
const items = shallowRef<InstalledItem[]>([])
const usage = shallowRef<{ pack_id: number; pilot: string }[]>([])
const usageError = ref('')
const biomods = ref(0)
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const fileInput = useTemplateRef('fileInput')
const candidate = shallowRef<LcpPack | null>(null)
const filename = ref('')
const targetName = ref<string | null>(null)
const reading = ref(false)
const saving = ref(false)
const loadingCore = ref(false)
const coreInstalled = computed(() => hasCoreContent(items.value))
// The seed's ids, read once core is installed. The seed is a large file, so it loads only then.
const seedIds = shallowRef<string[]>([])
watch(coreInstalled, async (on) => {
  if (on && !seedIds.value.length) seedIds.value = (await import('../coreContent').catch(() => null))?.coreContent.items.map(item => item.id) ?? []
}, { immediate: true })
const coreUpdatable = computed(() => coreNeedsUpdate(items.value, seedIds.value))
const fileError = ref('')
const saveError = ref('')
const result = shallowRef<{ name: string; version: string; added: number; updated: number; retained: number } | null>(null)
const removal = shallowRef<{ ok: boolean; text: string } | null>(null)
const plan = computed(() => candidate.value ? planLcp(candidate.value, packs.value, items.value) : null)
const filteredPacks = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return packs.value.filter(pack => `${pack.name} ${authorOf(pack)}`.toLocaleLowerCase().includes(query))
})
const previewKinds = computed(() => Object.entries(LCP_KINDS)
  .map(([kind, label]) => ({ kind, label, count: candidate.value?.items.filter(item => item.kind === kind).length ?? 0 }))
  .filter(row => row.count))
const totals = computed(() => Object.entries(LCP_KINDS).map(([kind, label]) => ({ kind, label, count: items.value.filter(item => item.kind === kind).length })))
// Why the import can't run yet, if it can't.
const blocker = computed(() => plan.value?.conflicts.length ? 'Fix the item IDs first'
  : loadError.value ? "Content didn't load" : loading.value ? 'Loading…' : '')
const packCount = (id: number) => items.value.filter(item => item.pack_id === id).length
// Pilots using items from a pack, each named once: it can't be removed while there are any.
const usersOf = (id: number) => [...new Set(usage.value.filter(row => row.pack_id === id).map(row => row.pilot))]
function usedBy(id: number) {
  const names = usersOf(id)
  return `Used by ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}`
}
function authorOf(pack: InstalledPack) {
  const manifest = pack.manifest as Record<string, Json> | null
  return typeof manifest?.author === 'string' ? manifest.author : ''
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [packRows, modRows, usageRows] = await Promise.all([
      supabase.from('content_packs').select('*').order('name'),
      supabase.from('bionics').select('id', { count: 'exact', head: true }),
      supabase.rpc('pack_usage'),
    ])
    if (packRows.error) throw packRows.error
    if (modRows.error) throw modRows.error
    const all = await loadContentIndex()
    if (all.error) throw new Error(all.error)
    packs.value = packRows.data ?? []
    items.value = all.rows.map((row) => ({ id: row.id, pack_id: row.pack_id, kind: row.kind, edited: row.edited_id !== null }))
    // A failed check only blocks removing, never importing.
    usage.value = usageRows.data ?? []
    usageError.value = usageRows.error ? "Couldn't check who uses it." : ''
    biomods.value = modRows.count ?? 0
  } catch (error) {
    loadError.value = `Content didn't load: ${readError(message(error))}`
  } finally { loading.value = false }
}
watch(isOwner, owner => owner && load(), { immediate: true })

function chooseFile(pack?: InstalledPack) {
  targetName.value = pack?.name ?? null
  fileInput.value?.click()
}
// Starts reading a file: clears the last file's preview, result and errors.
function reset(name: string) {
  reading.value = true
  candidate.value = null
  result.value = null
  removal.value = null
  fileError.value = ''
  saveError.value = ''
  filename.value = name
}
async function inspect(file: File) {
  if (reading.value || saving.value) return
  reset(file.name)
  try {
    if (!/\.(lcp|zip)$/i.test(file.name)) throw new Error('Choose an .lcp file.')
    if (file.size > MAX_LCP_BYTES) throw new Error('That file is over 15 MB.')
    const parsed = await readLcp(new Uint8Array(await file.arrayBuffer()))
    if (targetName.value && parsed.manifest.name !== targetName.value)
      throw new Error(`This file is for ${parsed.manifest.name}, not ${targetName.value}.`)
    candidate.value = parsed
  } catch (error) {
    fileError.value = error instanceof Error ? error.message : "That isn't a valid .lcp file."
  } finally { reading.value = false }
}
function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) inspect(file)
  input.value = ''
}
function cancel() {
  candidate.value = null
  filename.value = ''
  saveError.value = ''
}
async function loadCoreContent() {
  if ((coreInstalled.value && !coreUpdatable.value) || loading.value || loadError.value || reading.value || saving.value) return
  loadingCore.value = true
  reset('Official core content')
  try {
    const { coreContent } = await import('../coreContent')
    candidate.value = coreContent
    reading.value = false
    // A partial or conflicting installation needs the normal conflict preview.
    if (!plan.value?.conflicts.length) await importPack()
  } catch (error) {
    fileError.value = `Core content didn't load: ${error instanceof Error ? readError(error.message) : 'Try again.'}`
  } finally {
    reading.value = false
    loadingCore.value = false
  }
}
async function importPack() {
  if (!candidate.value || !plan.value || plan.value.conflicts.length || loading.value || saving.value) return
  const pack = candidate.value
  const current = plan.value.existing
  saving.value = true
  saveError.value = ''
  try {
    const { data, error } = await supabase.rpc('import_lcp', {
      pack_manifest: pack.manifest,
      pack_items: pack.items as unknown as Json,
      expected_pack_id: current?.id ?? undefined,
      expected_imported_at: current?.imported_at ?? undefined,
    })
    if (error) throw error
    const counts = data as { added: number; updated: number; retained: number }
    result.value = { name: pack.manifest.name, version: pack.manifest.version, ...counts }
    invalidateCatalogues()
    candidate.value = null
    filename.value = ''
    await load()
  } catch (error) {
    saveError.value = `Not imported: ${readError(message(error))}`
    // Refresh metadata so a retry previews the current catalogue after a conflict.
    await load()
  } finally { saving.value = false }
}
async function removePack(pack: InstalledPack) {
  if (loading.value || loadError.value || reading.value || saving.value) return
  const count = packCount(pack.id)
  const ok = await confirmAction(`Remove ${pack.name} and its ${plural(count, 'item')}? This can't be undone.`, { confirmLabel: 'Remove pack', danger: true })
  if (!ok) return
  saving.value = true
  result.value = null
  try {
    const { error } = await supabase.rpc('remove_pack', { target_pack_id: pack.id })
    if (error) throw error
    removal.value = { ok: true, text: `Removed ${pack.name}.` }
    invalidateCatalogues()
  } catch (error) {
    removal.value = { ok: false, text: `Not removed: ${readError(message(error))}` }
  } finally { saving.value = false }
  await load()
}
</script>

<template>
  <main class="page">
    <PageHeader title="GM content" summary="Game content packs.">
      <div v-if="isOwner" class="actions">
        <button v-if="!loading && !loadError && (!coreInstalled || coreUpdatable)" type="button" :class="{ primary: !candidate }" :disabled="reading || saving || loadingCore" @click="loadCoreContent">{{ loadingCore ? 'Loading…' : coreUpdatable ? 'Update core content' : 'Load core content' }}</button>
        <button type="button" :class="{ primary: coreInstalled && !candidate }" :disabled="loading || !!loadError || reading || saving" @click="chooseFile()">Import pack</button>
        <RouterLink :to="{ name: 'gm-content-editor' }" class="link-button">Open editor</RouterLink>
      </div>
    </PageHeader>
    <p v-if="!profile" class="dim">Loading…</p>
    <p v-else-if="!isOwner" class="notice warn" role="alert">Only owners can see this page.</p>
    <template v-else>
      <input ref="fileInput" class="file-input" type="file" accept=".lcp,.zip" aria-label="Choose pack file" :disabled="reading || saving" @change="onFile" />
      <div v-if="loadError" class="notice warn" role="alert">
        <div class="notice-head">
          <p>{{ loadError }}</p>
          <button type="button" class="small" :disabled="loading" @click="load">Retry</button>
        </div>
      </div>
      <p v-if="loading" class="dim" role="status">Loading…</p>
      <div v-if="result" class="notice ok" role="status">
        <p class="notice-title">{{ result.name }} imported</p>
        <p>Version <span class="num">{{ result.version }}</span>: <span class="num">{{ result.added }}</span> new, <span class="num">{{ result.updated }}</span> updated.</p>
      </div>
      <p v-if="removal" class="notice" :class="removal.ok ? 'ok' : 'warn'" :role="removal.ok ? 'status' : 'alert'">{{ removal.text }}</p>
      <p v-if="fileError" class="notice warn" role="alert">{{ fileError }}</p>
      <p v-if="reading" role="status" class="dim">Loading…</p>

      <FileSection v-if="candidate && plan" id="import-preview" no="01" :title="plan.existing ? 'Review pack update' : 'Review import'" fixed>
        <p class="dim file">{{ filename }}</p>
        <h3 class="pack-title">{{ candidate.manifest.name }}</h3>
        <p class="sep dim">
          <span>By {{ candidate.manifest.author }}</span>
          <span>Version <span class="num">{{ plan.existing?.version ? `${plan.existing.version} → ` : '' }}{{ candidate.manifest.version }}</span></span>
        </p>
        <p class="prose">{{ plainPackText(candidate.manifest.description) }}</p>
        <ul class="totals" aria-label="What this import changes">
          <li class="added"><span class="num">+{{ plan.added }}</span> new</li>
          <li class="updated"><span class="num">~{{ plan.updated }}</span> to update</li>
          <li class="dim"><span class="num">{{ plan.retained }}</span> older items kept</li>
        </ul>
        <ul class="counts" aria-label="Content in this file">
          <li v-for="row in previewKinds" :key="row.kind"><span class="label">{{ row.label }}</span><span class="num">{{ row.count }}</span></li>
        </ul>
        <div class="checks">
          <p v-if="plan.edited" class="notice">
            <span><span class="num">{{ plan.edited }}</span> {{ plan.edited === 1 ? 'item has' : 'items have' }} campaign edits. The update keeps them.</span>
          </p>
          <p v-for="warning in candidate.warnings" :key="warning" class="notice">{{ warning }}</p>
          <details v-if="candidate.ignored.length" class="ignored">
            <summary><span class="num">{{ candidate.ignored.length }}</span> {{ candidate.ignored.length === 1 ? 'file' : 'files' }} not used</summary>
            <ul><li v-for="file in candidate.ignored" :key="file" class="code">{{ file }}</li></ul>
          </details>
          <div v-if="plan.conflicts.length" class="notice warn" role="alert">
            <p class="notice-title">Item ID conflict</p>
            <p>Give these items unique IDs, or update their original pack.</p>
            <ul><li v-for="conflict in plan.conflicts" :key="conflict.id"><span class="code">{{ conflict.id }}</span>: {{ conflict.reason }}</li></ul>
          </div>
          <p v-if="saveError" class="notice warn" role="alert">{{ saveError }}</p>
        </div>
        <footer class="preview-foot">
          <div class="actions">
            <button type="button" class="quiet" :disabled="saving" @click="cancel">Cancel</button>
            <span v-if="blocker && !saving" class="blocked">
              <button type="button" class="primary" disabled aria-describedby="import-blocked">{{ plan.existing ? 'Update pack' : 'Import pack' }}</button>
              <span id="import-blocked" class="blocked-reason">{{ blocker }}</span>
            </span>
            <button v-else type="button" class="primary" :disabled="saving" @click="importPack">{{ saving ? 'Importing…' : plan.existing ? 'Update pack' : 'Import pack' }}</button>
          </div>
        </footer>
      </FileSection>

      <FileSection id="installed-packs" :no="candidate ? '02' : '01'" title="Installed packs" fixed>
        <p v-if="!loadError" class="dim summary"><span class="num">{{ packs.length }}</span> {{ packs.length === 1 ? 'pack' : 'packs' }}, <span class="num">{{ items.length }}</span> items</p>
        <div v-if="packs.length" class="search">
          <label class="field"><span>Search</span><input v-model="search" type="search" placeholder="Pack name or author" /></label>
        </div>
        <p v-if="!loading && !packs.length && !loadError" class="empty">No packs yet.</p>
        <p v-else-if="!loading && packs.length && !filteredPacks.length" class="empty">Nothing matches that search.</p>
        <div v-else-if="filteredPacks.length" class="table-window" role="region" aria-label="Installed packs" tabindex="0">
          <table class="table">
            <thead><tr><th scope="col">Pack</th><th scope="col">Version</th><th scope="col" class="number">Items</th><th scope="col">Last imported</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody><tr v-for="pack in filteredPacks" :key="pack.id">
              <td><strong>{{ pack.name }}</strong><span v-if="authorOf(pack)" class="author dim">{{ authorOf(pack) }}</span></td>
              <td class="num">{{ pack.version ?? '–' }}</td>
              <td class="number num">{{ packCount(pack.id) }}</td>
              <td class="dim">{{ formatDate(pack.imported_at) }}</td>
              <td class="row-actions-cell"><div class="row-actions">
                <button type="button" class="small" :disabled="loading || !!loadError || reading || saving" :aria-label="`Update ${pack.name}`" @click="chooseFile(pack)">Update</button>
                <span v-if="usageError || usersOf(pack.id).length" class="blocked">
                  <button type="button" class="small danger" disabled :aria-label="`Remove ${pack.name}`" :aria-describedby="`used-${pack.id}`">Remove</button>
                  <span :id="`used-${pack.id}`" class="blocked-reason">{{ usageError || usedBy(pack.id) }}</span>
                </span>
                <button v-else type="button" class="small danger" :disabled="loading || !!loadError || reading || saving" :aria-label="`Remove ${pack.name}`" @click="removePack(pack)">Remove</button>
              </div></td>
            </tr></tbody>
          </table>
        </div>
      </FileSection>

      <FileSection v-if="!loading && !loadError" id="content-library" :no="candidate ? '03' : '02'" title="Content library" fixed>
        <ul class="counts">
          <li v-for="row in totals" :key="row.kind"><span class="label">{{ row.label }}</span><span class="num">{{ row.count }}</span></li>
          <li><span class="label">Biomods</span><span class="num">{{ biomods }}</span></li>
        </ul>
      </FileSection>
    </template>
  </main>
</template>

<style scoped>
main > * + * { margin-top: var(--space-l); }
.file-input { display: none; }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-s); }

/* --- The import preview --- */
.file { margin: 0 0 var(--space-m); overflow-wrap: anywhere; }
.summary { margin: 0 0 var(--space-m); }
.pack-title { margin: 0 0 var(--space-xs); font-size: var(--fs-l); overflow-wrap: anywhere; }
.sep { margin: 0 0 var(--space-m); font-size: var(--fs-s); }
.prose { margin: 0 0 var(--space-l); }
/* What changes: a status colour, always with a symbol and a word. */
.totals { display: flex; flex-wrap: wrap; gap: var(--space-s) var(--space-xl); margin: 0 0 var(--space-m); padding: 0; list-style: none; }
.totals .num { font-weight: 700; }
.added { color: var(--ok); }
.updated { color: var(--info); }
.checks { display: flex; flex-direction: column; gap: var(--space-m); margin-top: var(--space-l); }
.checks > p { margin: 0; }
.ignored p { margin: var(--space-s) 0; }
.ignored summary { color: var(--lilac); cursor: pointer; }
.ignored li, .code { overflow-wrap: anywhere; }
.preview-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-m) var(--space-xl); margin-top: var(--space-l); padding-top: var(--space-l); border-top: 1px solid var(--rule); }
.preview-foot p { flex: 1 1 24rem; margin: 0; font-size: var(--fs-s); }
.preview-foot .actions { margin-left: auto; }

/* --- Installed packs --- */
.search { margin-bottom: var(--space-m); }
.search .field { max-width: 28rem; }
.table-window { position: relative; /* holds the .sr-only heading, which would otherwise widen the page */ overflow: auto; border: 1px solid var(--rule); border-radius: var(--radius); }
.author { display: block; font-size: var(--fs-xs); }
/* The reason a pack can't be removed wraps beside its button instead of widening the table. */
.table td.row-actions-cell { min-width: 14rem; white-space: normal; }
.row-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-xs) var(--space-s); }

/* --- Counts per kind of content (the preview and the library): the label, then the number at the right. --- */
.counts { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr)); gap: 0 var(--space-xl); margin: 0; padding: 0; list-style: none; }
.counts li { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-m); padding: var(--space-s) 0; border-bottom: 1px solid var(--rule); }
.counts .num { font-weight: 700; }

/* Phones: the action buttons share the row, the totals stack. */
@media (max-width: 40rem) {
  .actions > :is(button, a) { flex: 1 1 auto; }
  .preview-foot .actions { width: 100%; margin-left: 0; }
  .totals { flex-direction: column; gap: var(--space-xs); }
  .counts { grid-template-columns: minmax(0, 1fr); }
}
</style>
