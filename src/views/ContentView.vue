<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { isOwner, profile } from '../auth'
import PageHeader from '../components/PageHeader.vue'
import { fetchAll, supabase } from '../lib/supabaseClient'
import type { Json } from '../lib/database.types'
import { invalidateCatalogues } from '../gameData'
import { LCP_KINDS, MAX_LCP_BYTES, hasCoreContent, plainPackText, planLcp, readLcp, type InstalledItem, type InstalledPack, type LcpPack } from '../lcp'

// Preview locally, then save the complete pack with one owner-only database call.
const packs = shallowRef<InstalledPack[]>([])
const items = shallowRef<InstalledItem[]>([])
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
const fileError = ref('')
const saveError = ref('')
const result = shallowRef<{ name: string; version: string; added: number; updated: number; retained: number } | null>(null)
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
const blocker = computed(() => plan.value?.conflicts.length ? 'Fix the item IDs above first.'
  : loadError.value ? 'Installed content failed to load.' : loading.value ? 'Loading installed content…' : '')
const packCount = (id: number) => items.value.filter(item => item.pack_id === id).length
function authorOf(pack: InstalledPack) {
  const manifest = pack.manifest as Record<string, Json> | null
  return typeof manifest?.author === 'string' ? manifest.author : ''
}
function dateOf(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [packRows, modRows] = await Promise.all([
      supabase.from('content_packs').select('*').order('name'),
      supabase.from('bionics').select('id', { count: 'exact', head: true }),
    ])
    if (packRows.error) throw packRows.error
    if (modRows.error) throw modRows.error
    // Catalogue metadata can exceed the API's 1,000-row response limit.
    const all = await fetchAll((from, to) => supabase.from('content_items').select('id, pack_id, kind').order('id').range(from, to))
    if (all.error) throw new Error(all.error)
    packs.value = packRows.data ?? []
    items.value = all.rows
    biomods.value = modRows.count ?? 0
  } catch (error) {
    loadError.value = `Could not load installed content. ${error instanceof Error ? error.message : String((error as { message?: string }).message ?? error)}`
  } finally { loading.value = false }
}
watch(isOwner, owner => owner && load(), { immediate: true })

function chooseFile(pack?: InstalledPack) {
  targetName.value = pack?.name ?? null
  fileInput.value?.click()
}
async function inspect(file: File) {
  if (reading.value || saving.value) return
  reading.value = true
  candidate.value = null
  result.value = null
  fileError.value = ''
  saveError.value = ''
  filename.value = file.name
  try {
    if (!/\.(lcp|zip)$/i.test(file.name)) throw new Error('Choose an .lcp file or a ZIP export of one.')
    if (file.size > MAX_LCP_BYTES) throw new Error('Choose an LCP smaller than 15 MB.')
    const parsed = await readLcp(new Uint8Array(await file.arrayBuffer()))
    if (targetName.value && parsed.manifest.name !== targetName.value)
      throw new Error(`This file is for ${parsed.manifest.name}. Choose an update for ${targetName.value}, or use Import a pack to add it separately.`)
    candidate.value = parsed
  } catch (error) {
    fileError.value = error instanceof Error ? error.message : 'Could not read this pack. Choose a valid .lcp file.'
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
  if (coreInstalled.value || loading.value || loadError.value || reading.value || saving.value) return
  loadingCore.value = true
  reading.value = true
  candidate.value = null
  result.value = null
  fileError.value = ''
  saveError.value = ''
  filename.value = 'Official core content'
  try {
    const { coreContent } = await import('../coreContent')
    candidate.value = coreContent
    reading.value = false
    // A partial or conflicting installation needs the normal conflict preview.
    if (!plan.value?.conflicts.length) await importPack()
  } catch (error) {
    fileError.value = `Could not load core content. ${error instanceof Error ? error.message : 'Please try again.'}`
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
    saveError.value = `Import failed. ${String((error as { message?: string }).message ?? error)} No partial import was saved.`
    // Refresh metadata so a retry previews the current catalogue after a conflict.
    await load()
  } finally { saving.value = false }
}
</script>

<template>
  <main class="page">
    <PageHeader title="GM content" summary="The packs behind your pilots, mechs and equipment.">
      <div v-if="isOwner" class="actions">
        <button v-if="!loading && !loadError && !coreInstalled" type="button" :class="{ primary: !candidate }" :disabled="reading || saving || loadingCore" @click="loadCoreContent">{{ loadingCore ? 'Loading core content…' : 'Load core content' }}</button>
        <button type="button" :class="{ primary: coreInstalled && !candidate }" :disabled="loading || !!loadError || reading || saving" @click="chooseFile()">Import a pack</button>
      </div>
    </PageHeader>
    <p v-if="!profile" class="dim">Loading…</p>
    <p v-else-if="!isOwner" class="notice warn" role="alert">Access denied. This page is for owners.</p>
    <template v-else>
      <input ref="fileInput" class="file-input" type="file" accept=".lcp,.zip" aria-label="Choose Lancer content pack" :disabled="reading || saving" @change="onFile" />
      <div v-if="loadError" class="notice warn" role="alert">
        <div class="notice-head">
          <p>{{ loadError }}</p>
          <button type="button" class="small" :disabled="loading" @click="load">Try again</button>
        </div>
      </div>
      <p v-if="loading" class="dim" role="status">Loading installed content…</p>
      <div v-if="result" class="notice ok" role="status">
        <p class="notice-title">{{ result.name }} is ready</p>
        <p>Version <span class="num">{{ result.version }}</span> imported: <span class="num">{{ result.added }}</span> new, <span class="num">{{ result.updated }}</span> updated, <span class="num">{{ result.retained }}</span> older items kept.</p>
        <p>Its content is now in the pilot and mech pickers.</p>
      </div>
      <p v-if="fileError" class="notice warn" role="alert">{{ fileError }}</p>
      <p v-if="reading" role="status" class="dim">Checking {{ filename }}…</p>

      <section v-if="candidate && plan" class="panel" aria-labelledby="preview-title">
        <header class="panel-head">
          <h2 id="preview-title">{{ plan.existing ? 'Review pack update' : 'Review import' }}</h2>
          <p class="dim file">{{ filename }}</p>
        </header>
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
          <p v-if="plan.retained" class="dim">Older items missing from this update stay available, so existing pilots keep their equipment.</p>
          <p v-for="warning in candidate.warnings" :key="warning" class="notice">{{ warning }}</p>
          <details v-if="candidate.ignored.length" class="ignored">
            <summary><span class="num">{{ candidate.ignored.length }}</span> {{ candidate.ignored.length === 1 ? 'file' : 'files' }} not used by this site</summary>
            <p class="dim">Only supported content files at the top level are imported.</p>
            <ul><li v-for="file in candidate.ignored" :key="file" class="code">{{ file }}</li></ul>
          </details>
          <div v-if="plan.conflicts.length" class="notice warn" role="alert">
            <p class="notice-title">Item IDs need attention</p>
            <p>This import is blocked. Give these items unique IDs in the LCP editor, or choose an update for their original pack.</p>
            <ul><li v-for="conflict in plan.conflicts" :key="conflict.id"><span class="code">{{ conflict.id }}</span>: {{ conflict.reason }}</li></ul>
          </div>
          <p v-if="saveError" class="notice warn" role="alert">{{ saveError }}</p>
        </div>
        <footer class="preview-foot">
          <p v-if="saving || !blocker" class="dim">{{ saving ? 'Importing the pack and all its items…' : plan.existing ? 'Updated rules apply wherever these items are used. Older items stay available.' : 'Import this pack to make its content available to character sheets.' }}</p>
          <div class="actions">
            <button type="button" class="quiet" :disabled="saving" @click="cancel">Cancel</button>
            <span v-if="blocker && !saving" class="blocked">
              <button type="button" class="primary" disabled aria-describedby="import-blocked">{{ plan.existing ? 'Update pack' : 'Import pack' }}</button>
              <span id="import-blocked" class="blocked-reason">{{ blocker }}</span>
            </span>
            <button v-else type="button" class="primary" :disabled="saving" @click="importPack">{{ saving ? 'Importing…' : plan.existing ? 'Update pack' : 'Import pack' }}</button>
          </div>
        </footer>
      </section>

      <section class="panel" aria-labelledby="installed-title">
        <header class="panel-head">
          <h2 id="installed-title">Installed packs</h2>
          <p class="dim"><span class="num">{{ packs.length }}</span> {{ packs.length === 1 ? 'pack' : 'packs' }}, <span class="num">{{ items.length }}</span> items</p>
        </header>
        <div v-if="packs.length" class="search">
          <label class="field"><span>Search</span><input v-model="search" type="search" placeholder="Pack name or author" /></label>
        </div>
        <p v-if="!loading && !packs.length && !loadError" class="empty">No packs installed yet. Import an LCP to fill the pilot and mech pickers.</p>
        <p v-else-if="!loading && packs.length && !filteredPacks.length" class="empty">No packs match that search.</p>
        <div v-else-if="filteredPacks.length" class="table-window" role="region" aria-label="Installed packs" tabindex="0">
          <table class="table">
            <thead><tr><th scope="col">Pack</th><th scope="col">Version</th><th scope="col" class="number">Items</th><th scope="col">Last imported</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody><tr v-for="pack in filteredPacks" :key="pack.id">
              <td><strong>{{ pack.name }}</strong><span v-if="authorOf(pack)" class="author dim">{{ authorOf(pack) }}</span></td>
              <td class="num">{{ pack.version ?? '–' }}</td>
              <td class="number num">{{ packCount(pack.id) }}</td>
              <td class="dim">{{ dateOf(pack.imported_at) }}</td>
              <td><button type="button" class="small" :disabled="loading || !!loadError || reading || saving" :aria-label="`Update ${pack.name}`" @click="chooseFile(pack)">Update</button></td>
            </tr></tbody>
          </table>
        </div>
      </section>

      <section v-if="!loading && !loadError" class="panel" aria-labelledby="library-title">
        <header class="panel-head">
          <h2 id="library-title">Content library</h2>
          <p class="dim">Everything available to character sheets. Biomods are campaign content, managed apart from LCPs.</p>
        </header>
        <ul class="counts">
          <li v-for="row in totals" :key="row.kind"><span class="label">{{ row.label }}</span><span class="num">{{ row.count }}</span></li>
          <li><span class="label">biomods</span><span class="num">{{ biomods }}</span></li>
        </ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
main > * + * { margin-top: var(--space-l); }
.file-input { display: none; }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-s); }

/* --- The import preview --- */
.file { overflow-wrap: anywhere; }
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
.table th, .table td { white-space: nowrap; vertical-align: middle; }
.table .number { text-align: right; }
.author { display: block; font-size: var(--fs-xs); }

/* --- Counts per kind of content (the preview and the library): the label, then the number at the right. --- */
.counts { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr)); gap: 0 var(--space-xl); margin: 0; padding: 0; list-style: none; }
.counts li { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-m); padding: var(--space-s) 0; border-bottom: 1px solid var(--rule); }
.counts .num { font-weight: 700; }
</style>
