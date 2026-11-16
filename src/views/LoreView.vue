<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm } from '../auth'
import Icon from '../components/Icon.vue'
import LoreEntry from '../components/LoreEntry.vue'
import PageHeader from '../components/PageHeader.vue'
import {
  KIND_INFO, LORE_KINDS, createDraft, entries, entryDate, formatDate, isDraft, loadLore, loaded, loreMatches, readTime, type LoreKind,
} from '../lore'

// Lore, like the archives' list + detail pane: a slim list of entries (a box per kind, newest first) and, on desktop,
// the chosen entry beside it. /lore shows the newest; /lore/:id the one in the url (these are shared on Discord). On
// phones (under 56rem, as the archives) the list is a page and an entry is a page of its own.
const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id ?? ''))

const error = ref('')
onMounted(async () => (error.value = await loadLore()))

// Search, and the kind filter (none chosen shows every kind).
const query = ref('')
const kinds = ref<LoreKind[]>([])
const searchBox = useTemplateRef<HTMLInputElement>('searchBox')
const toggleKind = (kind: LoreKind) => (kinds.value = kinds.value.includes(kind) ? kinds.value.filter((k) => k !== kind) : [...kinds.value, kind])
const clear = () => ((query.value = ''), (kinds.value = []))

const found = computed(() => entries.value.filter((entry) => loreMatches(entry, query.value)))
const shown = computed(() => (kinds.value.length ? found.value.filter((entry) => kinds.value.includes(entry.kind)) : found.value))
const groups = computed(() => LORE_KINDS.map((kind) => ({ kind, list: shown.value.filter((entry) => entry.kind === kind) })).filter((group) => group.list.length))
const filtering = computed(() => Boolean(query.value.trim() || kinds.value.length))

// The pane: the entry in the url, else the newest listed. The url's one may not be listed (a filter, say): it still shows.
const requested = computed(() => entries.value.find((entry) => entry.id === id.value))
// With none chosen: the newest published entry (a GM's newest draft only when nothing is published).
const selected = computed(() => (id.value ? requested.value : (shown.value.find((entry) => !isDraft(entry)) ?? shown.value[0])))
const missing = computed(() => loaded.value && Boolean(id.value) && !requested.value)

const wideQuery = window.matchMedia('not all and (max-width: 56rem)')
const wide = ref(wideQuery.matches)
const onWide = (event: MediaQueryListEvent) => (wide.value = event.matches)
wideQuery.addEventListener('change', onWide)
onUnmounted(() => wideQuery.removeEventListener('change', onWide))
const entryPage = computed(() => !wide.value && Boolean(id.value))

async function newEntry() {
  const draft = await createDraft()
  if (draft.error) error.value = draft.error
  else router.push({ name: 'lore-edit', params: { id: draft.id } })
}

const facts = (entry: (typeof entries.value)[number]) => `${isDraft(entry) ? 'Edited ' : ''}${formatDate(entryDate(entry))} · ${readTime(entry.body)}`

// A new entry in the pane starts at its top, and its row is brought into the list's view. Only the list scrolls,
// never the page.
const pane = useTemplateRef<HTMLElement>('pane')
const listBox = useTemplateRef<HTMLElement>('listBox')
watch(selected, () => pane.value?.scrollTo({ top: 0 }), { flush: 'post' })
watch([selected, shown], () => {
  const list = listBox.value
  const row = list?.querySelector<HTMLElement>('.row[aria-current="true"]')
  if (!list || !row || !wide.value) return
  // What of the list is on screen: before the page scrolls and it sticks, its foot can be below the window's.
  const box = list.getBoundingClientRect()
  const seen = Math.min(box.bottom, window.innerHeight) - box.top
  const top = row.getBoundingClientRect().top - box.top + list.scrollTop
  if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + seen) list.scrollTop = top - seen / 3
}, { flush: 'post' })

// Arrow keys move through the list (on desktop choosing as they go); Tab and Enter work as for any link.
function step(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const rows = [...(listBox.value?.querySelectorAll<HTMLAnchorElement>('.row') ?? [])]
  const next = rows[rows.indexOf(document.activeElement as HTMLAnchorElement) + (event.key === 'ArrowDown' ? 1 : -1)]
  if (!rows.includes(document.activeElement as HTMLAnchorElement) || !next) return
  event.preventDefault()
  next.focus()
  if (wide.value) next.click()
}
</script>

<template>
  <main class="page lore">
    <!-- Phones: an entry is a page of its own. -->
    <template v-if="entryPage">
      <p v-if="!loaded" class="dim">Loading…</p>
      <p v-else-if="missing || !selected" class="empty" role="status">
        <span>This entry isn't available.</span>
        <RouterLink :to="{ name: 'lore' }">Back to Lore</RouterLink>
      </p>
      <LoreEntry v-else :entry="selected" :entries="entries" page />
    </template>

    <template v-else>
      <PageHeader title="Lore" :summary="String(route.meta.summary ?? '')">
        <button v-if="isGm" type="button" class="primary" @click="newEntry"><Icon name="plus" />New entry</button>
      </PageHeader>

      <p v-if="error" class="notice warn" role="alert">Lore didn't load: {{ error }}</p>

      <div class="search">
        <label class="field">
          <span>Search lore</span>
          <input ref="searchBox" v-model="query" type="search" placeholder="Title, summary or text" @keydown.esc="query = ''" />
        </label>
        <button v-if="query" type="button" class="small" @click="(query = ''), searchBox?.focus()">Clear</button>
      </div>
      <div class="filters">
        <div class="kinds" role="group" aria-label="Filter by kind">
          <button
            v-for="kind in LORE_KINDS"
            :key="kind"
            type="button"
            class="kind-chip"
            :aria-pressed="kinds.includes(kind)"
            @click="toggleKind(kind)"
          >
            <Icon :name="KIND_INFO[kind].icon" />{{ KIND_INFO[kind].plural }}
            <span class="num">{{ found.filter((entry) => entry.kind === kind).length }}</span>
          </button>
        </div>
        <span v-if="isGm" class="private">Only GMs can see drafts.</span>
      </div>

      <p v-if="!loaded && !error" class="dim">Loading…</p>
      <div v-else-if="loaded && !entries.length" class="empty" role="status">
        <span>No lore yet.</span>
        <button v-if="isGm" type="button" class="small" @click="newEntry">New entry</button>
      </div>
      <div v-else-if="loaded && !shown.length" class="empty" role="status">
        <span>Nothing matches that search.</span>
        <button v-if="filtering" type="button" class="small" @click="clear">Clear</button>
      </div>

      <div v-else-if="loaded" class="browser">
        <nav ref="listBox" class="list" aria-label="Entries" @keydown="step">
          <section v-for="group in groups" :key="group.kind" class="group" :aria-label="KIND_INFO[group.kind].plural">
            <header class="group-head">
              <Icon :name="KIND_INFO[group.kind].icon" class="kind-icon" />
              <h2>{{ KIND_INFO[group.kind].plural }}</h2>
              <span class="num dim count">{{ group.list.length }}</span>
            </header>
            <ul class="rows">
              <li v-for="entry in group.list" :key="entry.id">
                <RouterLink
                  :to="{ name: 'lore-entry', params: { id: entry.id } }"
                  :replace="wide"
                  class="row"
                  :aria-current="wide && entry === selected ? 'true' : undefined"
                >
                  <span class="row-top">
                    <span class="row-name">{{ entry.title }}</span>
                    <span v-if="isDraft(entry)" class="badge draft">Draft</span>
                  </span>
                  <span class="row-facts">{{ facts(entry) }}</span>
                </RouterLink>
              </li>
            </ul>
          </section>
        </nav>
        <div v-if="wide" ref="pane" class="pane" aria-live="polite">
          <p v-if="missing || !selected" class="empty" role="status">
            <span>This entry isn't available.</span>
            <RouterLink :to="{ name: 'lore' }">Back to Lore</RouterLink>
          </p>
          <LoreEntry v-else :entry="selected" :entries="entries" />
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.lore {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
}

.lore > .page-header {
  margin-bottom: 0;
}

.search {
  display: flex;
  align-items: flex-end;
  gap: var(--space-s);
}

.search .field {
  flex: 0 1 36rem;
}

.search input {
  width: 100%;
  font-size: 1rem;
}

/* The kind filter: neutral toggle chips (the archives' manufacturer chips, without a maker colour). */
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-l);
}

.kinds {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
}

.kind-chip {
  min-height: 2.25rem;
  padding: 0.2rem 0.7rem;
  border-color: var(--rule);
  color: var(--text);
  font-size: 0.875rem;
}

.kind-chip .icon {
  width: 16px;
  height: 16px;
  color: var(--text-dim);
}

.kind-chip .num {
  color: var(--text-dim);
  font-weight: 400;
}

.kind-chip:hover {
  border-color: var(--edge);
}

.kind-chip[aria-pressed='true'] {
  border-color: var(--lilac);
  background: color-mix(in srgb, var(--lilac) 14%, transparent);
  color: var(--lilac);
}

.kind-chip[aria-pressed='true'] .icon,
.kind-chip[aria-pressed='true'] .num {
  color: var(--lilac);
}

.filters .private {
  margin-left: auto;
}

/* --- The list (22rem) and the chosen entry beside it, each sticky under the top bar and scrolling on its own.
   Phones: the list alone, in the page. --- */
.browser {
  --stick: calc(var(--topbar-h) + var(--space-m));
  display: grid;
  grid-template-columns: 22rem minmax(0, 1fr);
  align-items: start;
  gap: var(--space-l);
}

.list,
.pane {
  position: sticky;
  top: var(--stick);
  max-height: calc(100dvh - var(--stick) - var(--space-m));
  overflow-y: auto;
  overscroll-behavior: contain;
}

.list {
  display: grid;
  gap: var(--space-m);
  padding-right: 2px; /* room for the focus ring beside the scrollbar */
}

.pane {
  padding: var(--space-xl);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
}

/* A kind's box, as the archives' manufacturer boxes. */
.group {
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
}

.group-head {
  display: flex;
  align-items: center;
  gap: var(--space-s);
  padding: var(--space-s) var(--space-m);
  border-bottom: 1px solid var(--rule);
}

.kind-icon {
  width: 18px;
  height: 18px;
  color: var(--text-dim);
}

.group-head h2 {
  margin: 0;
  font-size: var(--fs-s);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.group-head .count {
  margin-left: auto;
  font-size: var(--fs-xs);
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A row: a real link, the title over its date and reading time, a thin rule between rows. The chosen one is lilac
   with a bar. */
.row {
  display: grid;
  justify-items: start;
  gap: 2px;
  width: 100%;
  min-height: var(--tap);
  padding: 6px var(--space-m);
  border-top: 1px solid var(--rule);
  color: var(--text);
  text-decoration: none;
}

.rows > li:first-child > .row {
  border-top: 0;
}

.row:hover {
  background: var(--raised);
}

.row:focus-visible {
  outline: 2px solid var(--lilac);
  outline-offset: -2px;
}

.row[aria-current='true'] {
  background: color-mix(in srgb, var(--lilac) 14%, transparent);
  box-shadow: inset 3px 0 0 var(--lilac);
  color: var(--lilac);
}

.row-top {
  display: flex;
  align-items: center;
  gap: var(--space-s);
  width: 100%;
}

.row-name {
  font-size: var(--fs-s);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.row-top .badge {
  flex: none;
  margin-left: auto;
}

.row-facts {
  color: var(--text-dim);
  font-size: var(--fs-xs);
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

  .row-facts {
    font-size: var(--fs-s);
  }
}

/* Phones: the filter chips scroll sideways in one row instead of wrapping into a tall block. */
@media (max-width: 40rem) {
  .filters {
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
  }

  .kinds {
    flex-wrap: nowrap;
    margin-inline: calc(-1 * var(--space-l));
    padding-inline: var(--space-l);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .kind-chip {
    flex: none;
    min-height: 44px;
  }

  .filters .private {
    margin-left: 0;
  }
}
</style>
