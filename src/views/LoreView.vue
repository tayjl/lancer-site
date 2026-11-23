<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm } from '../auth'
import Icon from '../components/Icon.vue'
import LoreEntry from '../components/LoreEntry.vue'
import PageHeader from '../components/PageHeader.vue'
import { useListPane } from '../listPane'
import { KIND_INFO, LORE_KINDS, entryMeta, isDraft, loreMatches, loreSection, type LoreKind } from '../lore'

// Lore, like the archives' list + detail pane: a slim list of entries (a box per kind, newest first) and, on desktop,
// the chosen entry beside it. /lore shows the newest; /lore/:id the one in the url (these are shared on Discord). On
// phones (under 56rem, as the archives) the list is a page and an entry is a page of its own. The route's meta.section picks
// the table (Pithub has its own view, PithubView.vue).
const route = useRoute()
const section = loreSection(route.meta.section)
const { entries, loaded } = section.store
const router = useRouter()
const id = computed(() => String(route.params.id ?? ''))

const error = ref('')
onMounted(async () => (error.value = await section.store.load()))

// Search, and the kind filter (none chosen shows every kind).
const query = ref('')
const kinds = ref<LoreKind[]>([])
const searchBox = useTemplateRef<HTMLInputElement>('searchBox')
// Phones: the chip row scrolls sideways; like the tabs (style.css), a fade over the right edge shows until the last chip is in view.
const kindsRow = useTemplateRef<HTMLElement>('kindsRow')
const fadeEnd = () => {
  const el = kindsRow.value
  if (el) el.toggleAttribute('data-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
}
const resized = new ResizeObserver(fadeEnd)
onMounted(() => kindsRow.value && resized.observe(kindsRow.value))
onUnmounted(() => resized.disconnect())
const toggleKind =(kind: LoreKind) => (kinds.value = kinds.value.includes(kind) ? kinds.value.filter((k) => k !== kind) : [...kinds.value, kind])
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

// The pane shows beside the list on desktop; on phones the list is a page and an entry is a page of its own.
const pane = useTemplateRef<HTMLElement>('pane')
const listBox = useTemplateRef<HTMLElement>('listBox')
const { wide, step } = useListPane({ selected, listed: shown, pane, listBox, active: () => wide.value })
const entryPage = computed(() => !wide.value && Boolean(id.value))

async function newEntry() {
  const draft = await section.store.createDraft()
  if (draft.error) error.value = draft.error
  else router.push({ name: section.edit, params: { id: draft.id } })
}

</script>

<template>
  <main class="page lore list-pane">
    <!-- Phones: an entry is a page of its own. -->
    <template v-if="entryPage">
      <p v-if="!loaded" class="dim">Loading…</p>
      <p v-else-if="missing || !selected" class="empty" role="status">
        <span>This entry isn't available.</span>
        <RouterLink :to="{ name: section.list }">Back to {{ section.name }}</RouterLink>
      </p>
      <LoreEntry v-else :entry="selected" :entries="entries" :section="section" page />
    </template>

    <template v-else>
      <PageHeader :title="section.name" :summary="String(route.meta.summary ?? '')">
        <button v-if="isGm" type="button" class="primary" @click="newEntry"><Icon name="plus" />New entry</button>
      </PageHeader>

      <p v-if="error" class="notice warn" role="alert">{{ section.name }} didn't load: {{ error }}</p>

      <div class="search">
        <label class="field">
          <span>Search</span>
          <input ref="searchBox" v-model="query" type="search" placeholder="Title, summary or text" @keydown.esc="query = ''" />
        </label>
        <button v-if="query" type="button" class="small" @click="(query = ''), searchBox?.focus()">Clear</button>
      </div>
      <div class="filters">
        <div ref="kindsRow" class="kinds" role="group" aria-label="Filter by kind" @scroll.passive="fadeEnd">
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
        <span>{{ section.empty }}</span>
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
                  :to="{ name: section.entry, params: { id: entry.id } }"
                  :replace="wide"
                  class="row"
                  :aria-current="wide && entry === selected ? 'true' : undefined"
                >
                  <span class="row-top">
                    <span class="row-name">{{ entry.title }}</span>
                    <span v-if="isDraft(entry)" class="badge draft">Draft</span>
                  </span>
                  <span class="row-facts">{{ entryMeta(entry) }}</span>
                </RouterLink>
              </li>
            </ul>
          </section>
        </nav>
        <div v-if="wide" ref="pane" class="pane" aria-live="polite">
          <p v-if="missing || !selected" class="empty" role="status">
            <span>This entry isn't available.</span>
            <RouterLink :to="{ name: section.list }">Back to {{ section.name }}</RouterLink>
          </p>
          <LoreEntry v-else :entry="selected" :entries="entries" :section="section" />
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

.row-name {
  font-size: var(--fs-s);
  font-weight: 700;
  overflow-wrap: anywhere;
}

@media (max-width: 56rem) {
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

  .kinds::after {
    content: '';
    position: sticky;
    right: 0;
    flex: none;
    width: 40px;
    margin-left: -40px;
    background: linear-gradient(to right, transparent, var(--void) 85%);
    pointer-events: none;
  }

  .kinds[data-end]::after {
    opacity: 0;
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
