<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { isOwner, profile } from '../auth'
import DefinitionPane from '../components/editor/DefinitionPane.vue'
import EditorPane from '../components/editor/EditorPane.vue'
import GroupHead from '../components/GroupHead.vue'
import Icon from '../components/Icon.vue'
import PageHeader from '../components/PageHeader.vue'
import SheetTabs from '../components/SheetTabs.vue'
import { EXOTIC_MAKER, archiveGroups, makerId, useManufacturers, type ArchiveEntry } from '../archive'
import { confirmAction } from '../confirm'
import { DEFINITIONS_TAB, HOMEBREW_PACK, KINDS, TAB_GROUPS, blankItem, groupOf, kindInfo, newId, type Data, type EditorKind } from '../contentEditor'
import { RULE_CATEGORIES, newRule, oldLink, ruleBoxes, ruleCounts } from '../ruleList'
import { exportHomebrew, loadCounts, loadIds, loadItem, loadList, loadPacks, loadStats, type ListRow, type Loaded, type Pack } from '../editorStore'
import { hiddenTags, loadBaseActions, loadRules, loadTagNames, tagNames } from '../gameData'
import { DEF_BOXES, DEF_KINDS, defKindInfo, loadDefinitionFacts, type DefKind } from '../definitions'
import { factsText } from '../definitionEditor'
import { useListPane } from '../listPane'

// The content editor (owners only): make and change the game content the site is built on, with a live preview of what
// players will see. A list beside an editor, like the archives; the kind picks what's listed (?cat=) and the item
// (?item=, "new" for a new one) what's edited. Items you make go in one pack, Campaign homebrew, as drafts until
// published; imported items can be edited too, and keep their edits through pack updates.
const route = useRoute()
const router = useRouter()
const setQuery = (changes: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...changes } })

// What the tab row and the list show, and what the pane edits (below).
const tab = computed<EditorKind>(() => KINDS.find((k) => k.key === route.query.cat)?.key ?? 'pilot_gear')
const info = computed(() => kindInfo(tab.value))
// The Definitions tab (?cat=definitions) lists the small game lists and edits one (?item=<list key>) as a whole.
const inDefs = computed(() => route.query.cat === DEFINITIONS_TAB)
const DEFS = 'Definitions'
const inRules = computed(() => tab.value === 'rules')
const sec = computed(() => (typeof route.query.sec === 'string' && route.query.sec ? route.query.sec : undefined))
// Old ?cat=rules&sec=tags and ?sec=actions links land on the Tags and Actions tabs, once.
watch(() => route.query, (query) => { const to = oldLink(query); if (to) router.replace({ query: { ...query, ...to } }) }, { immediate: true })
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
const facts = ref<Record<string, { entries: number; hidden: number }>>({})
const manufacturers = useManufacturers()
const homebrewId = computed(() => packs.value.find((pack) => pack.name === HOMEBREW_PACK)?.id ?? null)
const packName = (id: number | null) => packs.value.find((pack) => pack.id === id)?.name ?? ''
const tagChoices = computed(() => [...tagNames.value].filter(([id]) => !hiddenTags.value.has(id)).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))
// The Exotic pseudo-manufacturer (a constant, not a row) is always offered, last.
const makerChoices = computed(() => [...manufacturers.value.map((maker) => ({ id: maker.id, name: maker.name })), { id: EXOTIC_MAKER.id, name: EXOTIC_MAKER.name }])
// Two tab rows: the group, then the kinds of the current group (Definitions has no count). The group is worked out from ?cat=.
const tabName = (key: string) => (key === DEFINITIONS_TAB ? DEFS : kindInfo(key as EditorKind).label)
const group = computed(() => groupOf(inDefs.value ? DEFINITIONS_TAB : tab.value))
const groupLabels = TAB_GROUPS.map((g) => g.label)
const tabLabels = computed(() => group.value.tabs.map(tabName))
// Nothing shows until the counts are loaded.
const tabCounts = computed(() => !Object.keys(counts.value).length ? undefined : Object.fromEntries(KINDS.map((k) => [k.label, counts.value[k.key] ?? 0])))

async function refreshList() {
  if (inDefs.value) {
    const result = await loadDefinitionFacts()
    facts.value = result.facts
    listError.value = result.error ?? ''
    loadingList.value = false
    return
  }
  const result = await loadList(tab.value)
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
  loadBaseActions()
  loadRules()
  await refreshList()
}
watch(isOwner, (owner) => owner && refreshAll(), { immediate: true })
watch([tab, inDefs], () => { loadingList.value = true; rows.value = []; query.value = ''; refreshList() })

// The chosen item, read in full (the list holds only enough to show it).
const loaded = shallowRef<Loaded | null>(null)
const loadingItem = ref(false)
const itemError = ref('')
let loadToken = 0
watch([tab, itemKey, inDefs], async ([k, key, defs]) => {
  const token = ++loadToken
  loaded.value = null
  itemError.value = ''
  if (!key || key === 'new' || defs) return
  loadingItem.value = true
  const result = await loadItem(k, key)
  if (token !== loadToken) return
  loadingItem.value = false
  loaded.value = result.item
  itemError.value = result.error ?? (result.item ? '' : "This item isn't available.")
}, { immediate: true })

// A new item starts blank; its id is made from its name (src/contentEditor.ts).
// The other factions' or commendations' names, for the one-of-a-name check.
const otherNames = computed(() => rows.value.filter((row) => row.key !== loaded.value?.key).map((row) => row.name))
const taken = computed(() => takenIds.value ?? new Set<string>())
const kind = tab
// Duplicate opens a new item that starts from a copy.
const copy = shallowRef<Data | null>(null)
async function duplicate(data: Data) {
  if (!(await leave())) return
  copy.value = data
  setQuery({ item: 'new' })
}
watch([tab, itemKey], ([, key]) => { if (key !== 'new') copy.value = null })
const blank = computed(() => {
  if (isNewItem.value && copy.value) return copy.value
  const id = newId(kind.value, '', taken.value)
  return kind.value === 'rules' ? newRule(id, sec.value ?? '', rows.value) : blankItem(kind.value, id)
})

// Leaving or switching with unsaved changes asks first.
const pane = useTemplateRef<{ dirty: boolean }>('editor')
const paneBox = useTemplateRef<HTMLElement>('paneBox')
const listBox = useTemplateRef<HTMLElement>('listBox')
async function leave() {
  return !pane.value?.dirty || (await confirmAction("Discard unsaved changes? This can't be undone.", { confirmLabel: 'Discard changes', danger: true }))
}
onBeforeRouteLeave(leave)
async function choose(key: string | undefined) { if (key !== itemKey.value && (await leave())) setQuery({ item: key }) }
async function chooseKind(label: string) {
  const next = label === DEFS ? DEFINITIONS_TAB : KINDS.find((k) => k.label === label)?.key
  if (next && next !== (inDefs.value ? DEFINITIONS_TAB : tab.value) && (await leave())) setQuery({ cat: next, item: undefined, sec: undefined })
}
// Choosing a group opens its first kind.
async function chooseGroup(label: string) {
  const next = TAB_GROUPS.find((g) => g.label === label)
  if (next && next !== group.value && (await leave())) setQuery({ cat: next.tabs[0], item: undefined, sec: undefined })
}
async function newRuleIn(key: string) { if (await leave()) setQuery({ sec: key, item: 'new' }) }

// The list: a box per manufacturer for what has one (New sits above the boxes), otherwise a box per pack (Campaign homebrew
// first, always, so New is at hand).
const query = ref('')
const SHOWN = 40
const expanded = ref(new Set<string>())
const BY_MAKER: EditorKind[] = ['frames', 'weapons', 'systems', 'mods', 'core_bonuses', 'bionics']
const matches = (row: ListRow) => {
  const hay = `${row.name} ${row.key} ${row.facts}`.toLowerCase()
  return query.value.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word))
}
const groups = computed<{ key: string; id: number; name: string; rows: ListRow[]; total: number; more: number; add: boolean; logo?: string | null; colour?: string }[]>(() => {
  const found = rows.value.filter(matches)
  // Factions and commendations: one box.
  if (kind.value === 'factions' || kind.value === 'commendations') return found.length ? [{ key: 'all', id: 0, name: info.value.label, rows: found, total: rows.value.length, more: 0, add: false }] : []
  // A box per manufacturer like the archives' (archiveGroups: the maker's logo and colour, "Other" for none, Exotic last).
  if (BY_MAKER.includes(kind.value)) {
    const entries = found.map((row) => ({ category: 'biomods', id: row.key, name: row.name, group: makerId(row.source ?? '') || 'other', level: 0, licence: '', exotic: false, summary: '', search: '' }) as unknown as ArchiveEntry)
    return archiveGroups(entries, manufacturers.value).map((group) => {
      const all = group.entries.map((entry) => found.find((row) => row.key === entry.id)!)
      const limit = query.value.trim() || expanded.value.has(group.key) ? Infinity : SHOWN
      return {
        key: group.key, id: 0, name: group.title, rows: all.slice(0, limit), total: rows.value.filter((row) => (makerId(row.source ?? '') || 'other') === group.key).length,
        more: Math.max(0, all.length - limit), add: false, logo: group.logo, colour: group.colour,
      }
    })
  }
  const ids = [...new Set(rows.value.map((row) => row.packId))]
  const ordered = [...ids].sort((a, b) => (a === homebrewId.value ? -1 : b === homebrewId.value ? 1 : packName(a).localeCompare(packName(b))))
  if (homebrewId.value === null || !ids.includes(homebrewId.value)) ordered.unshift(homebrewId.value)
  return ordered.map((id) => {
    const all = found.filter((row) => row.packId === id)
    const limit = query.value.trim() || id === homebrewId.value || expanded.value.has(String(id ?? 0)) ? Infinity : SHOWN
    return { key: String(id ?? 0), id: id ?? 0, name: id === null ? HOMEBREW_PACK : packName(id), rows: all.slice(0, limit), total: rows.value.filter((row) => row.packId === id).length, more: Math.max(0, all.length - limit), add: id === homebrewId.value || id === null }
  })
})
const byMaker = computed(() => BY_MAKER.includes(kind.value))
// Rules: a box per category. {VAL} (where a tag's number goes) shows as X.
const ruleRows = computed(() => rows.value.map((row) => ({ ...row, name: row.name.replaceAll('{VAL}', 'X') })))
const boxes = computed(() => ruleBoxes(ruleRows.value, { sec: sec.value, query: query.value, expanded: expanded.value }))
const ruleCount = computed(() => ruleCounts(rows.value))
const defKey = computed(() => (defKindInfo(itemKey.value ?? '') ? (itemKey.value as DefKind) : undefined))
const listed = computed(() => (inDefs.value ? DEF_KINDS.map((k) => ({ key: k.key })) : inRules.value ? boxes.value.flatMap((box) => box.parts.flatMap((part) => part.rows)) : groups.value.flatMap((group) => group.rows)))
const showMore = (id: string) => (expanded.value = new Set([...expanded.value, id]))

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
  // Factions and biomods aren't pack items. The first homebrew item makes its pack: the new item belongs to it.
  if (!info.value.site) takenIds.value = new Set([...(takenIds.value ?? []), key])
  if (!info.value.site && homebrewId.value === null) packs.value = (await loadPacks()).packs
  await refreshList()
  setQuery({ item: key })
}
async function changed() {
  // The preview fills in tag, action and number placeholders from what's loaded.
  loadTagNames()
  loadBaseActions()
  loadRules()
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
        <div v-if="isOwner" class="actions">
          <span class="private gm">Owner only</span>
          <RouterLink :to="{ name: 'gm-content' }" class="link-button">Packs and imports</RouterLink>
          <button type="button" @click="exportLcp"><Icon name="download" />Export as .lcp</button>
        </div>
      </PageHeader>
    </div>

    <p v-if="!profile" class="dim">Loading…</p>
    <p v-else-if="!isOwner" class="notice warn" role="alert">Only owners can see this page.</p>
    <template v-else>
      <p v-if="exportNote" class="notice" :class="exportNote.ok ? 'ok' : 'warn'" :role="exportNote.ok ? 'status' : 'alert'">{{ exportNote.text }}</p>

      <div v-show="showList" class="group-bar">
        <SheetTabs :model-value="group.label" :tabs="groupLabels" label="Content group" @update:model-value="chooseGroup" />
      </div>
      <div v-show="showList" class="cat-bar">
        <SheetTabs :model-value="inDefs ? DEFS : info.label" :tabs="tabLabels" :counts="tabCounts" label="Kind of content" @update:model-value="chooseKind" />
      </div>

      <div class="browser">
        <nav v-show="showList" ref="listBox" class="list" :aria-label="inDefs ? DEFS : info.label" @keydown="step">
          <h2 class="sr-only">{{ inDefs ? DEFS : info.label }}</h2>
          <label v-if="inRules" class="field category">
            <span>Category</span>
            <select :value="sec ?? ''" @change="setQuery({ sec: ($event.target as HTMLSelectElement).value || undefined })">
              <option value="">All rules ({{ rows.length }})</option>
              <option v-for="c in RULE_CATEGORIES" :key="c.key" :value="c.key">{{ c.label }} ({{ ruleCount[c.key] ?? 0 }})</option>
            </select>
          </label>
          <label v-if="!inDefs" class="field search">
            <span class="sr-only">Search</span>
            <input v-model="query" type="search" :placeholder="`Search ${info.label.toLowerCase()}`" @keydown.esc="query = ''" />
          </label>
          <p v-if="listError" class="notice warn" role="alert">The list didn't load: {{ listError }}</p>
          <p v-else-if="loadingList" class="dim" role="status">Loading…</p>
          <template v-else-if="inDefs">
            <section v-for="box in DEF_BOXES" :key="box" class="group">
              <GroupHead :title="box" :count="DEF_KINDS.filter((k) => k.box === box).length" />
              <ul class="rows">
                <li v-for="k in DEF_KINDS.filter((k) => k.box === box)" :key="k.key">
                  <button type="button" class="row" :aria-current="wide && k.key === itemKey ? 'true' : undefined" @click="choose(k.key)">
                    <span class="row-top"><span class="row-name">{{ k.label }}</span></span>
                    <span class="row-facts">{{ factsText(facts[k.key]?.entries ?? 0, facts[k.key]?.hidden ?? 0) }}</span>
                  </button>
                </li>
              </ul>
            </section>
          </template>
          <template v-else-if="inRules">
            <section v-for="box in boxes" :key="box.key" class="group">
              <GroupHead :title="box.label" :count="box.total">
                <button v-if="box.add" type="button" class="small" :aria-label="`New rule in ${box.label}`" @click="newRuleIn(box.key)"><Icon name="plus" />New rule</button>
              </GroupHead>
              <template v-for="part in box.parts" :key="part.label ?? ''">
                <h4 v-if="part.label" class="label sub">{{ part.label }}</h4>
                <ul class="rows">
                  <li v-for="row in part.rows" :key="row.key">
                    <button type="button" class="row" :aria-current="wide && row.key === itemKey ? 'true' : undefined" @click="choose(row.key)">
                      <span class="row-top">
                        <span class="row-name">{{ row.name }}</span>
                        <span v-if="row.draft" class="badge draft">Draft</span>
                        <span v-else-if="row.edited" class="badge">Edited</span>
                        <span v-if="row.hidden" class="badge">Hidden</span>
                      </span>
                      <span v-if="row.facts" class="row-facts">{{ row.facts }}</span>
                    </button>
                  </li>
                </ul>
              </template>
              <p v-if="!box.total" class="empty">No items yet.</p>
              <div v-if="box.more" class="more"><button type="button" class="quiet small" @click="showMore(box.key)">Show {{ box.more }} more</button></div>
            </section>
            <p v-if="query.trim() && !boxes.length" class="empty">Nothing matches that search.</p>
          </template>
          <template v-else>
            <button v-if="byMaker" type="button" class="small add-site" @click="choose('new')"><Icon name="plus" />New {{ info.singular }}</button>
            <p v-if="byMaker && !groups.length" class="empty">{{ query.trim() ? 'Nothing matches that search.' : 'No items yet.' }}</p>
            <section v-for="group in groups" :key="group.key" class="group" :class="{ branded: group.logo || (group.colour && group.colour !== 'var(--lilac)') }" :style="group.colour ? { '--mf': group.colour } : undefined">
              <GroupHead :title="group.name" :count="group.total" :logo="group.logo">
                <button v-if="group.add" type="button" class="small" @click="choose('new')"><Icon name="plus" />New {{ info.singular }}</button>
              </GroupHead>
              <ul class="rows">
                <li v-for="row in group.rows" :key="row.key">
                  <button type="button" class="row" :aria-current="wide && row.key === itemKey ? 'true' : undefined" @click="choose(row.key)">
                    <span class="row-top">
                      <span class="row-name">{{ row.name }}</span>
                      <span v-if="row.draft" class="badge draft">Draft</span>
                      <span v-else-if="row.edited" class="badge">Edited</span>
                      <span v-if="row.hidden" class="badge">Hidden</span>
                    </span>
                    <span v-if="row.facts" class="row-facts">{{ row.facts }}</span>
                  </button>
                </li>
              </ul>
              <p v-if="!group.rows.length && !group.more" class="empty">{{ query.trim() ? 'Nothing matches that search.' : 'No items yet.' }}</p>
              <div v-if="group.more" class="more"><button type="button" class="quiet small" @click="showMore(group.key)">Show {{ group.more }} more</button></div>
            </section>
          </template>
        </nav>

        <div v-show="showPane" ref="paneBox" class="pane-box">
          <button v-if="!wide" type="button" class="quiet small back" @click="choose(undefined)"><Icon name="arrow-left" />{{ inDefs ? DEFS : info.label }}</button>
          <template v-if="inDefs">
            <DefinitionPane v-if="defKey" :key="defKey" ref="editor" :kind="defKey" @changed="refreshList" />
            <p v-else class="empty">Choose a list.</p>
          </template>
          <p v-else-if="loadingItem || (itemKey && !ready)" class="dim" role="status">Loading…</p>
          <p v-else-if="itemError" class="notice warn" role="alert">{{ itemError }}</p>
          <EditorPane
            v-else-if="loaded"
            :key="`${loaded.kind}:${loaded.key}`"
            ref="editor"
            :kind="loaded.kind"
            :item="loaded"
            :packs="packs"
            :pack-name="packName(loaded.packId)"
            :homebrew-id="homebrewId"
            :tags="tagChoices"
            :known-tags="tagNames"
            :manufacturers="makerChoices"
            :stats="stats"
            :taken-ids="taken"
            :names="otherNames"
            :blank="blank"
            :wide="wide"
            @changed="changed"
            @deleted="deleted"
            @duplicate="duplicate"
          />
          <EditorPane
            v-else-if="isNewItem"
            :key="`${kind}:new:${sec}`"
            ref="editor"
            :kind="kind"
            :item="null"
            :packs="packs"
            pack-name=""
            :homebrew-id="homebrewId"
            :tags="tagChoices"
            :known-tags="tagNames"
            :manufacturers="makerChoices"
            :stats="stats"
            :taken-ids="taken"
            :names="otherNames"
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

/* The groups sit tight above the kinds, as one block. They scroll away: only the kinds stick. */
.group-bar {
  margin-block: calc(-1 * var(--space-s));
}

/* Bigger, sentence case: the kinds below stay the small uppercase tabs with counts. */
.group-bar :deep(.tab) {
  font-size: var(--fs-m);
  letter-spacing: 0;
  text-transform: none;
}

/* The kinds (SheetTabs, one row that scrolls sideways when narrow): sticky under the top bar, with the page's background. */
.cat-bar {
  position: sticky;
  top: var(--topbar-h);
  z-index: 4;
  margin-block: calc(-1 * var(--space-s));
  background: var(--void);
}

/* The list on the left (18rem on desktop) and the editor beside it. The list sticks and scrolls on its own; the editor scrolls
   with the page, its bar sticking. Phones: one at a time. */
.browser {
  --stick: calc(var(--topbar-h) + var(--tabs-h) + 1px + var(--space-m));
}

/* Desktop: the form (not the list) gets the room. The page is wider through the route's meta.wide (App.vue). */
@media (min-width: 56.01rem) {
  .browser {
    grid-template-columns: 18rem minmax(0, 1fr);
  }
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
.search,
.category {
  display: block;
}

.sub {
  margin: 0;
  padding: var(--space-s) var(--space-m) 4px;
  border-top: 1px solid var(--rule);
}

.group-head + .sub {
  border-top: 0;
}

.add-site {
  justify-self: start;
}

.row-name {
  min-width: 0;
  font-size: var(--fs-s);
  font-weight: 700;
  overflow-wrap: anywhere;
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
  .row {
    min-height: 52px;
  }

  .row-name {
    font-size: var(--fs-m);
  }
}
</style>
