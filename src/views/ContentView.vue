<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { isOwner, profile } from '../auth'
import PageHeader from '../components/PageHeader.vue'
import { supabase } from '../lib/supabaseClient'
import type { Json } from '../lib/database.types'
import { invalidateTagNames } from '../gameData'
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
    const all: InstalledItem[] = []
    // Catalogue metadata can exceed the API's 1,000-row response limit.
    for (let from = 0; ; from += 1000) {
      const page = await supabase.from('content_items').select('id, pack_id, kind').order('id').range(from, from + 999)
      if (page.error) throw page.error
      all.push(...(page.data ?? []))
      if ((page.data?.length ?? 0) < 1000) break
    }
    packs.value = packRows.data ?? []
    items.value = all
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
      throw new Error(`This file is for ${parsed.manifest.name}. Choose an update for ${targetName.value}, or use import a pack to add it separately.`)
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
  filename.value = 'official core content'
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
    invalidateTagNames()
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
  <main class="page content">
    <PageHeader title="gm: content" summary="the packs behind your pilots, mechs and equipment.">
      <div v-if="isOwner" class="actions">
        <button v-if="!loading && !loadError && !coreInstalled" type="button" class="confirm" :disabled="reading || saving || loadingCore" @click="loadCoreContent">{{ loadingCore ? 'loading core content…' : 'load core content' }}</button>
        <button type="button" :disabled="loading || !!loadError || reading || saving" @click="chooseFile()">import a pack</button>
      </div>
    </PageHeader>
    <p v-if="!profile" class="dim">loading...</p>
    <p v-else-if="!isOwner" class="rose">access denied. owners only.</p>
    <template v-else>
      <input ref="fileInput" class="file-input" type="file" accept=".lcp,.zip" aria-label="Choose Lancer content pack" :disabled="reading || saving" @change="onFile" />
      <div v-if="loadError" class="notice error" role="alert">
        <p>{{ loadError }}</p><button type="button" :disabled="loading" @click="load">try again</button>
      </div>
      <p v-if="loading" class="dim" role="status">loading installed content...</p>
      <div v-if="result" class="notice success" role="status">
        <h2>{{ result.name }} is ready</h2>
        <p>version {{ result.version }} imported. {{ result.added }} new, {{ result.updated }} updated, {{ result.retained }} older items retained.</p>
        <p class="dim">its content is available in the pilot and mech pickers.</p>
      </div>
      <p v-if="fileError" class="notice error" role="alert">{{ fileError }}</p>

      <section v-if="candidate && plan" class="preview" aria-labelledby="preview-title">
        <header class="section-head">
          <div><p class="dim filename">{{ filename }}</p><h2 id="preview-title">{{ plan.existing ? 'review pack update' : 'review import' }}</h2></div>
          <span class="version">{{ plan.existing?.version ? `${plan.existing.version} → ` : '' }}{{ candidate.manifest.version }}</span>
        </header>
        <h3 class="pack-title">{{ candidate.manifest.name }}</h3>
        <p class="dim">by {{ candidate.manifest.author }}</p>
        <p class="description">{{ plainPackText(candidate.manifest.description) }}</p>
        <dl class="preview-totals">
          <div><dt>new items</dt><dd class="gain">+{{ plan.added }}</dd></div>
          <div><dt>items to update</dt><dd class="sky">{{ plan.updated }}</dd></div>
          <div><dt>older items retained</dt><dd>{{ plan.retained }}</dd></div>
        </dl>
        <ul class="kind-counts" aria-label="Content in this file">
          <li v-for="row in previewKinds" :key="row.kind">{{ row.label }} <strong>{{ row.count }}</strong></li>
        </ul>
        <p v-if="plan.retained" class="dim">older items missing from this update stay available so existing pilots keep their equipment.</p>
        <p v-for="warning in candidate.warnings" :key="warning" class="notice warning">{{ warning }}</p>
        <details v-if="candidate.ignored.length" class="ignored">
          <summary>{{ candidate.ignored.length }} files not used by this character manager</summary>
          <p class="dim">only supported content files at the top level are imported.</p>
          <ul><li v-for="file in candidate.ignored" :key="file">{{ file }}</li></ul>
        </details>
        <div v-if="plan.conflicts.length" class="notice error" role="alert">
          <h3>item IDs need attention</h3>
          <p>this import is blocked. Give these items unique IDs in the LCP editor, or select an update for their original pack.</p>
          <ul><li v-for="conflict in plan.conflicts" :key="conflict.id"><code>{{ conflict.id }}</code>: {{ conflict.reason }}</li></ul>
        </div>
        <p v-if="saveError" class="notice error" role="alert">{{ saveError }}</p>
        <footer class="preview-actions">
          <p class="dim">{{ saving ? 'importing the pack and all its items…' : plan.existing ? 'updated rules apply wherever these items are used. Older items stay available.' : 'import this pack to make its content available to character sheets.' }}</p>
          <div class="actions">
            <button type="button" :disabled="saving" @click="cancel">cancel</button>
            <button type="button" class="confirm" :disabled="saving || loading || !!loadError || !!plan.conflicts.length" @click="importPack">{{ saving ? 'importing…' : plan.existing ? 'update pack' : 'import pack' }}</button>
          </div>
        </footer>
      </section>
      <p v-if="reading" role="status" class="dim">checking {{ filename }}…</p>

      <section class="installed" aria-labelledby="installed-title">
        <header class="section-head"><h2 id="installed-title">installed packs</h2><span class="dim">{{ packs.length }} {{ packs.length === 1 ? 'pack' : 'packs' }} · {{ items.length }} items</span></header>
        <label v-if="packs.length" class="search"><span>find a pack</span><input v-model="search" type="search" placeholder="search pack name or author" /></label>
        <p v-if="!loading && !packs.length && !loadError" class="empty dim">no packs installed yet. Import an LCP to start filling the pilot and mech pickers.</p>
        <p v-else-if="!loading && packs.length && !filteredPacks.length" class="empty dim">no packs match your search.</p>
        <div v-else-if="filteredPacks.length" class="table-window" role="region" aria-label="Installed packs" tabindex="0">
          <table>
            <thead><tr><th scope="col">pack</th><th scope="col">version</th><th scope="col">items</th><th scope="col">last imported</th><th scope="col">action</th></tr></thead>
            <tbody><tr v-for="pack in filteredPacks" :key="pack.id">
              <td><strong class="pack-name">{{ pack.name }}</strong><span v-if="authorOf(pack)" class="author dim">{{ authorOf(pack) }}</span></td>
              <td>{{ pack.version ?? '—' }}</td><td>{{ packCount(pack.id) }}</td><td class="dim">{{ dateOf(pack.imported_at) }}</td>
              <td><button type="button" :disabled="loading || !!loadError || reading || saving" :aria-label="`update ${pack.name}`" @click="chooseFile(pack)">update</button></td>
            </tr></tbody>
          </table>
        </div>
      </section>
      <section v-if="!loading && !loadError" class="library" aria-labelledby="library-title">
        <header class="section-head"><h2 id="library-title">content library</h2><span class="dim">available to your character sheets</span></header>
        <ul class="library-counts"><li v-for="row in totals" :key="row.kind"><span>{{ row.label }}</span><strong>{{ row.count }}</strong></li><li><span>biomods</span><strong>{{ biomods }}</strong></li></ul>
        <p class="dim library-note">biomods are campaign content and are managed separately from LCPs.</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.content { min-width: 0; max-width: none; }
.file-input { display: none; }
h2 { margin: 0; font-size: clamp(1.5rem, 2.5vw, 2rem); }
h3 { font-size: 1.125rem; }
p { max-width: 78ch; }
.section-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.75rem 2rem; margin-bottom: 1.25rem; }
.filename { margin: 0 0 0.5rem; font-size: 0.875rem; overflow-wrap: anywhere; }
.preview { padding: 1.5rem; border: 1px solid var(--lilac); background: var(--panel); }
.pack-title { margin: 0 0 0.4rem; color: var(--text); font-size: 1.375rem; }
.description { font-family: var(--read); line-height: 1.6; }
.version { padding: 0.25rem 0.6rem; border: 1px solid var(--rule); color: var(--sky); }
.preview-totals { display: flex; flex-wrap: wrap; gap: 0.75rem 2rem; margin: 1.5rem 0 1rem; }
.preview-totals > div { display: flex; align-items: baseline; gap: 0.6rem; }
.preview-totals dt { color: var(--text-dim); }
.preview-totals dd { margin: 0; font-size: 1.125rem; font-weight: 600; }
.gain, .success { color: var(--mint); }
.sky { color: var(--sky); }
.kind-counts { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; padding: 0; margin: 0 0 1.25rem; list-style: none; }
.kind-counts strong { color: var(--lilac); }
.ignored { margin: 1rem 0; }
summary { cursor: pointer; color: var(--sky); }
.ignored p { margin: 0.75rem 0; }
.ignored li, code { overflow-wrap: anywhere; }
.notice { margin: 0 0 1.25rem; padding: 1rem 1.25rem; border: 1px solid currentColor; }
.notice p { margin: 0.5rem 0 0; }
.notice h2 { font-size: 1.375rem; }
.notice h3 { margin: 0 0 0.5rem; }
.error { color: var(--rose); }
.warning { color: var(--sky); }
.preview-actions { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem 2rem; border-top: 1px solid var(--rule); margin-top: 1.5rem; padding-top: 1.25rem; }
.preview-actions p { flex: 1 1 28rem; margin: 0; font-size: 0.875rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; }
.confirm { color: var(--mint); }
button:disabled { opacity: 0.45; cursor: default; }
.installed, .library { margin-top: 3rem; }
.search { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
input[type='search'] { width: 100%; border: 1px solid var(--rule); background: var(--void); color: var(--text); padding: 0.65rem; font: inherit; }
.table-window { overflow: auto; border: 1px solid var(--rule); }
table { width: 100%; border-spacing: 0; border-collapse: separate; text-align: left; }
th { background: var(--panel); color: var(--text-dim); font-weight: 400; }
th, td { padding: 1rem; white-space: nowrap; }
tr + tr td { border-top: 1px solid var(--rule); }
.pack-name { color: var(--lilac); }
.author { display: block; margin-top: 0.25rem; font-size: 0.875rem; }
td button { padding-inline: 0; }
.empty { max-width: none; margin: 0; padding: 2rem; border: 1px dashed var(--rule); text-align: center; }
.library-counts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: 0; margin: 0; padding: 0; border-top: 1px solid var(--rule); list-style: none; }
.library-counts li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.85rem 1rem; border-bottom: 1px solid var(--rule); }
.library-counts strong { color: var(--lilac); }
.library-note { margin-top: 1rem; font-size: 0.875rem; }
@media (max-width: 40rem) { .preview { padding: 1.25rem; } .version { overflow-wrap: anywhere; } }
</style>
