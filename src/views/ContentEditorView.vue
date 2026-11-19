<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { isOwner, profile } from '../auth'
import EditorPane from '../components/editor/EditorPane.vue'
import Icon from '../components/Icon.vue'
import PageHeader from '../components/PageHeader.vue'
import SheetTabs from '../components/SheetTabs.vue'
import { useManufacturers } from '../archive'
import { confirmAction } from '../confirm'
import { HOMEBREW_PACK, KINDS, blankItem, kindInfo, newId, type EditorKind } from '../contentEditor'
import { exportHomebrew, loadCounts, loadIds, loadItem, loadList, loadPacks, loadStats, type ListRow, type Loaded, type Pack } from '../editorStore'
import { hiddenTags, loadTagNames, tagNames } from '../gameData'
import { useListPane } from '../listPane'

// The content editor (owners only): make and change the game content the site is built on, with a live preview of what
// players will see. A list beside an editor, like the archives; the kind picks what's listed (?cat=) and the item
// (?item=, "new" for a new one) what's edited. Items you make go in one pack, Campaign homebrew, as drafts until
// published; imported items can be edited too, and keep their edits through pack updates.
const route = useRoute()
const router = useRouter()
const setQuery = (changes: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...changes } })

const kind = computed<EditorKind>(() => KINDS.find((k) => k.key === route.query.cat)?.key ?? 'pilot_gear')
const info = computed(() => kindInfo(kind.value))
const itemKey = computed(() => (typeof route.query.item === 'string' && route.query.item ? route.query.item : undefined))
const isNewItem = computed(() => itemKey.value === 'new')

// What's on the page
const packs = shallowRef<Pack[]>([])
const rows = shallowRef<ListRow[]>([])
const counts = ref<Record<string, number>>({})
const stats = shallowRef<{ id: string; name: string }[]>([])
const takenIds = shallowRef<Set<string> | null>(null)
const loadingList = ref(true)
// The packs and ids are read before an item opens, as the editor decides from them whether it's homebrew.
const ready = ref(false)
const listError = ref('')
const manufacturers = useManufacturers()
const homebrewId = computed(() => packs.value.find((pack) => pack.name === HOMEBREW_PACK)?.id ?? null)
const packName = (id: number | null) => packs.value.find((pack) => pack.id === id)?.name ?? ''
const tagChoices = computed(() => [...tagNames.value].filter(([id]) => !hiddenTags.value.has(id)).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
const makerChoices = computed(() => manufacturers.value.map((maker) => ({ id: maker.id, name: maker.name })))
const tabLabels = KINDS.map((k) => k.label)
const tabCounts = computed(() => Object.fromEntries(KINDS.map((k) => [k.label, counts.value[k.key] ?? 0])))

async function refreshList() {
  const result = await loadList(kind.value)
  if (result.rows.length || !result.error) rows.value = result.rows
  listError.value = result.error ?? ''
  loadingList.value = false
  counts.value = await loadCounts()
}
async function refreshAll() {
  const [packList, statList] = await Promise.all([loadPacks(), loadStats()])
  packs.value = packList.packs
  stats.value = statList
  takenIds.value = await loadIds()
  ready.value = true
  loadTagNames()
  await refreshList()
}
onMounted(() => isOwner.value && refreshAll())
watch(isOwner, (owner) => owner && refreshAll())
watch(kind, () => { loadingList.value = true; rows.value = []; query.value = ''; refreshList() })

// The chosen item, read in full (the list holds only enough to show it).
const loaded = shallowRef<Loaded | null>(null)
const loadingItem = ref(false)
const itemError = ref('')
let loadToken = 0
watch([kind, itemKey], async ([k, key]) => {
  const token = ++loadToken
  loaded.value = null
  itemError.value = ''
  if (!key || key === 'new') return
  loadingItem.value = true
  const result = await loadItem(k, key)
  if (token !== loadToken) return
  loadingItem.value = false
  loaded.value = result.item
  itemError.value = result.error ?? (result.item ? '' : "This item isn't available.")
}, { immediate: true })

// A new item starts blank; its id is made from its name (src/contentEditor.ts).
const taken = computed(() => (kind.value === 'pilot_stats' ? new Set(stats.value.map((stat) => stat.id)) : takenIds.value ?? new Set<string>()))
const blank = computed(() => blankItem(kind.value, newId(kind.value, '', taken.value), stats.value.length + 1))

// Leaving or switching with unsaved changes asks first.
const pane = useTemplateRef<InstanceType<typeof EditorPane>>('editor')
const paneBox = useTemplateRef<HTMLElement>('paneBox')
const listBox = useTemplateRef<HTMLElement>('listBox')
async function leave() {
  return !pane.value?.dirty || (await confirmAction("Discard unsaved changes? This can't be undone.", { confirmLabel: 'Discard changes', danger: true }))
}
onBeforeRouteLeave(leave)
async function choose(key: string | undefined) { if (key !== itemKey.value && (await leave())) setQuery({ item: key }) }
async function chooseKind(label: string) {
  const next = KINDS.find((k) => k.label === label)
  if (next && next.key !== kind.value && (await leave())) setQuery({ cat: next.key, item: undefined })
}

// The list: a box per pack (Campaign homebrew first, always, so New is at hand), or one for a site table.
const query = ref('')
const SHOWN = 40
const expanded = ref(new Set<number>())
const matches = (row: ListRow) => {
  const hay = `${row.name} ${row.key} ${row.facts}`.toLowerCase()
  return query.value.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word))
}
const groups = computed(() => {
  const found = rows.value.filter(matches)
  if (info.value.site) return [{ id: 0, name: 'Site content', rows: found, total: rows.value.length, more: 0, add: true }]
  const ids = [...new Set(rows.value.map((row) => row.packId))]
  const ordered = [...ids].sort((a, b) => (a === homebrewId.value ? -1 : b === homebrewId.value ? 1 : packName(a).localeCompare(packName(b))))
  if (homebrewId.value === null || !ids.includes(homebrewId.value)) ordered.unshift(homebrewId.value)
  return ordered.map((id) => {
    const all = found.filter((row) => row.packId === id)
    const limit = query.value.trim() || id === homebrewId.value || expanded.value.has(id ?? 0) ? Infinity : SHOWN
    return { id: id ?? 0, name: id === null ? HOMEBREW_PACK : packName(id), rows: all.slice(0, limit), total: rows.value.filter((row) => row.packId === id).length, more: Math.max(0, all.length - limit), add: id === homebrewId.value || id === null }
  })
})
const listed = computed(() => groups.value.flatMap((group) => group.rows))
const showMore = (id: number) => (expanded.value = new Set([...expanded.value, id]))

const { wide, step } = useListPane({ selected: itemKey, listed, pane: paneBox, listBox, active: () => wide.value })
// Like the archives, the pane opens the first listed item when none is chosen (desktop only: phones keep the list). It's
// written into the url once, so searching afterwards can't swap the item under unsaved changes.
watch([listed, wide, itemKey, loadingList], () => {
  if (wide.value && !itemKey.value && !loadingList.value && listed.value.length) setQuery({ item: listed.value[0].key })
})
const showList = computed(() => wide.value || !itemKey.value)
const showPane = computed(() => wide.value || !!itemKey.value)

// What a pane's writes change in the page.
async function created(key: string) {
  takenIds.value = new Set([...(takenIds.value ?? []), key])
  // The first homebrew item makes its pack: the new item belongs to it.
  if (homebrewId.value === null) packs.value = (await loadPacks()).packs
  if (kind.value === 'pilot_stats') stats.value = await loadStats()
  await refreshList()
  setQuery({ item: key })
}
async function changed() {
  if (kind.value === 'pilot_stats') stats.value = await loadStats()
  if (kind.value === 'tags') loadTagNames()
  await refreshList()
}
async function deleted() {
  const removed = itemKey.value
  if (removed) takenIds.value = new Set([...(takenIds.value ?? [])].filter((id) => id !== removed))
  await refreshList()
  setQuery({ item: undefined })
}

// Export the homebrew as an .lcp the content page can import (here, or on another copy of the site).
const exportNote = ref<{ ok: boolean; text: string } | null>(null)
async function exportLcp() {
  exportNote.value = null
  const result = await exportHomebrew()
  if ('error' in result) return (exportNote.value = { ok: false, text: `Not exported: ${result.error}` })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([result.bytes as BlobPart], { type: 'application/zip' }))
  link.download = result.filename
  link.click()
  URL.revokeObjectURL(link.href)
  exportNote.value = { ok: true, text: `Exported ${result.count} ${result.count === 1 ? 'item' : 'items'} to ${result.filename}.` }
}
</script>

<template>
  <main class="page list-pane editor">
    <div v-show="showList" class="head">
      <PageHeader
        title="Content editor"
        summary="Make and change game content."
        :crumbs="[{ label: 'GM' }, { label: 'Content', to: { name: 'gm-content' } }, { label: 'Editor' }]"
      >
        <div class="actions">
          <span class="private">Owner only</span>
          <RouterLink :to="{ name: 'gm-content' }" class="link-button">Packs and imports</RouterLink>
          <button type="button" @click="exportLcp"><Icon name="download" />Export as .lcp</button>
        </div>
      </PageHeader>
    </div>

    <p v-if="!profile" class="dim">Loading…</p>
    <p v-else-if="!isOwner" class="notice warn" role="alert">Only owners can see this page.</p>
    <template v-else>
      <p v-if="exportNote" class="notice" :class="exportNote.ok ? 'ok' : 'warn'" :role="exportNote.ok ? 'status' : 'alert'">{{ exportNote.text }}</p>

      <div v-show="showList" class="cat-bar">
        <SheetTabs :model-value="info.label" :tabs="tabLabels" :counts="tabCounts" label="Kind of content" @update:model-value="chooseKind" />
      </div>

      <div class="browser">
        <nav v-show="showList" ref="listBox" class="list" :aria-label="info.label" @keydown="step">
          <label class="field search">
            <span class="sr-only">Search</span>
            <input v-model="query" type="search" :placeholder="`Search ${info.label.toLowerCase()}`" @keydown.esc="query = ''" />
          </label>
          <p v-if="listError" class="notice warn" role="alert">The list didn't load: {{ listError }}</p>
          <p v-else-if="loadingList" class="dim" role="status">Loading…</p>
          <template v-else>
            <section v-for="group in groups" :key="group.name" class="group">
              <header class="group-head">
                <h3>{{ group.name }}</h3>
                <span class="num dim count">{{ group.total }}</span>
                <button v-if="group.add" type="button" class="small add" @click="choose('new')"><Icon name="plus" />New {{ info.singular }}</button>
              </header>
              <ul class="rows">
                <li v-for="row in group.rows" :key="row.key">
                  <button type="button" class="row" :aria-current="wide && row.key === itemKey ? 'true' : undefined" @click="choose(row.key)">
                    <span class="row-top">
                      <span class="row-name">{{ row.name }}</span>
                      <span v-if="row.draft" class="badge draft">Draft</span>
                      <span v-else-if="row.edited" class="badge">Edited</span>
                    </span>
                    <span v-if="row.facts" class="row-facts">{{ row.facts }}</span>
                  </button>
                </li>
              </ul>
              <p v-if="!group.rows.length && !group.more" class="none dim">{{ query.trim() ? 'Nothing matches that search.' : 'No items yet.' }}</p>
              <div v-if="group.more" class="more"><button type="button" class="quiet small" @click="showMore(group.id)">Show {{ group.more }} more</button></div>
            </section>
          </template>
        </nav>

        <div v-show="showPane" ref="paneBox" class="pane-box">
          <button v-if="!wide" type="button" class="quiet small back" @click="choose(undefined)"><Icon name="arrow-left" />{{ info.label }}</button>
          <p v-if="loadingItem || (itemKey && !ready)" class="dim" role="status">Loading…</p>
          <p v-else-if="itemError" class="notice warn" role="alert">{{ itemError }}</p>
          <EditorPane
            v-else-if="loaded"
            :key="`${kind}:${loaded.key}`"
            ref="editor"
            :kind="kind"
            :item="loaded"
            :packs="packs"
            :pack-name="packName(loaded.packId)"
            :homebrew-id="homebrewId"
            :tags="tagChoices"
            :manufacturers="makerChoices"
            :stats="stats"
            :taken-ids="taken"
            :blank="blank"
            :wide="wide"
            @changed="changed"
            @deleted="deleted"
          />
          <EditorPane
            v-else-if="isNewItem"
            :key="`${kind}:new`"
            ref="editor"
            :kind="kind"
            :item="null"
            :packs="packs"
            pack-name=""
            :homebrew-id="homebrewId"
            :tags="tagChoices"
            :manufacturers="makerChoices"
            :stats="stats"
            :taken-ids="taken"
            :blank="blank"
            :wide="wide"
            @created="created"
          />
          <p v-else class="empty">Choose an item.</p>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
}

.head > :deep(.page-header) {
  margin-bottom: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s);
}

/* The kinds (SheetTabs, one row that scrolls sideways when narrow): sticky under the top bar, with the page's background. */
.cat-bar {
  position: sticky;
  top: var(--topbar-h);
  z-index: 4;
  margin-block: calc(-1 * var(--space-s));
  background: var(--void);
}

/* The list on the left (22rem) and the editor beside it. The list sticks and scrolls on its own; the editor scrolls
   with the page, its bar sticking. Phones: one at a time. */
.browser {
  --stick: calc(var(--topbar-h) + var(--tabs-h) + 1px + var(--space-m));
  display: grid;
  grid-template-columns: 22rem minmax(0, 1fr);
  align-items: start;
  gap: var(--space-l);
}

.list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: var(--space-m);
  padding-right: 2px; /* room for the focus ring beside the scrollbar */
  overflow-x: hidden;
}

.list .search .field,
.search {
  display: block;
}

.group-head h3 {
  min-width: 0;
  margin: 0;
  font-size: var(--fs-s);
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
  text-transform: uppercase;
}

.group-head .count {
  margin-left: 0;
  font-size: var(--fs-xs);
}

.group-head .add {
  flex: none;
  margin-left: auto;
}

/* A row: a real button, the name over its facts, a thin rule between rows. The chosen one is lilac with a bar. */
.row {
  display: grid;
  justify-content: stretch; /* the global button centres its contents */
  justify-items: start;
  gap: 2px;
  width: 100%;
  min-height: var(--tap);
  padding: 6px var(--space-m);
  border: 0;
  border-top: 1px solid var(--rule);
  border-radius: 0;
  background: none;
  color: var(--text);
  font: inherit;
  letter-spacing: 0;
  text-align: left;
  text-transform: none;
}

.row-top {
  display: flex;
  align-items: center;
  gap: var(--space-s);
  width: 100%;
}

.row-name {
  min-width: 0;
  font-size: var(--fs-s);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.row-top .badge {
  margin-left: auto;
  flex: none;
}

.none {
  margin: 0;
  padding: var(--space-s) var(--space-m);
  font-size: var(--fs-s);
}

.more {
  display: flex;
  padding: 4px var(--space-s);
  border-top: 1px solid var(--rule);
}

.pane-box {
  display: grid;
  gap: var(--space-s);
  min-width: 0;
}

.back {
  justify-self: start;
}

@media (max-width: 56rem) {
  .browser {
    grid-template-columns: minmax(0, 1fr);
  }

  .list {
    position: static;
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }

  .row {
    min-height: 52px;
  }

  .row-name {
    font-size: var(--fs-m);
  }
}
</style>
