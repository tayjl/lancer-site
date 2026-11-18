<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InfoBody from '../components/InfoBody.vue'
import InfoButton from '../components/InfoButton.vue'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import PageHeader from '../components/PageHeader.vue'
import RulesText from '../components/RulesText.vue'
import SheetTabs from '../components/SheetTabs.vue'
import Icon from '../components/Icon.vue'
import {
  ARCHIVE_CATEGORIES, MAKER_CATEGORIES, archiveEntries, archiveGroups, filterByMakers, listFacts, makerColour, makerLogo, parseItem,
  parseMakers, searchArchive, useManufacturers, type ArchiveCategory, type ArchiveEntry,
} from '../archive'
import { useGameData } from '../gameData'
import { manufacturerInfo, showInfo, shownInfo, type Manufacturer } from '../info'
import { useListPane } from '../listPane'
import { useMechData } from '../mechData'

// The archives, like COMP/CON's compendium: pick a category from the sticky row of tabs to browse it, or search
// every category at once. The landing is a big card per manufacturer in its own colour. A category is a list + detail
// pane: on desktop a slim list of names (grouped by manufacturer, licence or gear type, one or two key facts each) and
// the chosen entry's full information beside it (InfoBody.vue); on phones the list only, an entry opening the
// information dialog (InfoDialog.vue).
const { frames, weapons, systems, mods } = useMechData()
const { gear, bionics, pilotStats, talents, coreBonuses } = useGameData()
const manufacturers = useManufacturers()

const entries = computed(() =>
  archiveEntries({
    manufacturers: manufacturers.value,
    frames: frames.value,
    weapons: weapons.value,
    systems: systems.value,
    mods: mods.value,
    gear: gear.value,
    biomods: bionics.value,
    statNames: new Map(pilotStats.value.map((stat) => [stat.id, stat.name])),
    talents: talents.value,
    coreBonuses: coreBonuses.value,
  }),
)
// What a card shows under the code (the full name, unless replaced here) and as its motto (the pack's quote, unless
// replaced here). HORUS has no other name, so its line under the code is a glitching greeting instead, and its
// long message is shortened.
const SUBTITLES: Record<string, string> = { HORUS: 'CONGRATULATIONS, PILOT.' }
const GLITCHED = new Set(['HORUS'])
const MOTTOS: Record<string, string> = {
  GMS: 'From Cradle to the stars: GMS.',
  HORUS: 'Access is yours, so long as you can keep it.',
}
const subtitle = (maker: Manufacturer) => SUBTITLES[maker.id] ?? (maker.name !== maker.id ? maker.name : '')

// The url holds the view (?cat=frames), the search (?q=goblin), the manufacturer filter (?maker=GMS,IPS-N) and the
// open entry (?item=frames:mf_goblin), defaults left out, like the pilot sheet's ?tab=, so reloads and shared links
// keep them. While searching, no category means "all"; otherwise it means the manufacturers. So a search typed on
// the manufacturers goes to "all", one typed in a category stays in it, and clearing it goes back.
const route = useRoute()
const router = useRouter()
const setQuery = (changes: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...changes } })
const query = ref(String(route.query.q ?? ''))
const searchBox = useTemplateRef<HTMLInputElement>('searchBox')
watch(query, (q) => setQuery({ q: q || undefined }))
watch(() => route.query.q, (q) => (query.value = String(q ?? '')))
const searching = computed(() => Boolean(query.value.trim()))
type View = ArchiveCategory | 'all'
const view = computed<View>({
  get: () => ARCHIVE_CATEGORIES.find((cat) => cat === route.query.cat) ?? (searching.value ? 'all' : 'manufacturers'),
  set: (cat) => setQuery({ cat: cat === 'all' || (cat === 'manufacturers' && !searching.value) ? undefined : cat }),
})
const landing = computed(() => view.value === 'manufacturers' && !searching.value)
const tabs = computed(() => (searching.value ? ['all', ...ARCHIVE_CATEGORIES] : ARCHIVE_CATEGORIES))
// On narrow screens the bar scrolls sideways: keep the chosen category in sight (again as the counts arrive and
// widen the options).
const bar = useTemplateRef<HTMLElement>('bar')
// Sideways only (never scrolls the page). Offsets are from .cat-bar, which is positioned (sticky).
const showCurrent = () => {
  const nav = bar.value?.querySelector('nav')
  const current = nav?.querySelector<HTMLElement>('[aria-current="true"]')
  if (nav && current) nav.scrollLeft = current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2
}
onMounted(showCurrent)

// The manufacturer filter: none chosen shows everything.
const chosenMakers = computed(() => parseMakers(route.query.maker, manufacturers.value))
const toggleMaker = (id: string) => {
  const chosen = chosenMakers.value.includes(id) ? chosenMakers.value.filter((m) => m !== id) : [...chosenMakers.value, id]
  setQuery({ maker: chosen.join(',') || undefined })
}

// Search results (best first) or everything, then the filter; the tabs count what each category would show.
const found = computed(() => (searching.value ? searchArchive(entries.value, query.value) : entries.value))
const inView = (entry: ArchiveEntry) => view.value === 'all' || entry.category === view.value
const shown = computed(() => filterByMakers(found.value, chosenMakers.value))
const tabCounts = computed(() => ({
  all: shown.value.length,
  ...Object.fromEntries(ARCHIVE_CATEGORIES.map((cat) => [cat, shown.value.filter((entry) => entry.category === cat).length])),
}))
watch(() => [view.value, tabCounts.value], showCurrent, { flush: 'post' })
// The filter's chips: the manufacturers in this view (and any chosen), not on the landing cards or gear and talents.
const makerChips = computed(() => {
  if (landing.value || (view.value !== 'all' && !MAKER_CATEGORIES.includes(view.value))) return []
  const present = new Set(found.value.filter(inView).map((entry) => entry.group))
  return manufacturers.value.filter((maker) => present.has(maker.id) || chosenMakers.value.includes(maker.id))
})

// What's listed: one block of groups for a category; across every category, a block per category with a heading and
// its best matches first.
const blocks = computed(() => {
  const list = shown.value.filter(inView)
  if (view.value !== 'all') return [{ name: '', count: list.length, groups: archiveGroups(list, manufacturers.value) }]
  return ARCHIVE_CATEGORIES.map((name) => list.filter((entry) => entry.category === name))
    .filter((matches) => matches.length)
    .map((matches) => ({ name: matches[0].category, count: matches.length, groups: archiveGroups(matches, manufacturers.value, true) }))
})
// The list's entries in the order they're shown.
const listed = computed(() => blocks.value.flatMap((block) => block.groups.flatMap((group) => group.sections.flatMap((section) => section.entries))))

// A manufacturer card's counts, each a shortcut to that category (filtered to the maker). Every row always shows,
// even 0 (GMS sells no licences, NHC no weapon mods), so every card has the same rows.
const MADE: ArchiveCategory[] = ['licences', 'frames', 'mech weapons', 'mech systems', 'weapon mods', 'biomods', 'core bonuses']
const counts = (maker: Manufacturer) =>
  MADE.map((made) => ({ made, count: entries.value.filter((entry) => entry.category === made && entry.group === maker.id).length }))

const key = (entry: ArchiveEntry) => `${entry.category}:${entry.id}`

// The open entry lives in the url (?item=), so it can be linked. On desktop it's the one in the pane (the first listed
// when there's none, or when it isn't listed any more, e.g. after a filter); elsewhere a link opens the dialog once
// its catalogue has loaded (they don't say when they're done, so this watches the entries). One that isn't there
// once its category has loaded, or isn't a link at all, is dropped; so is the dialog's when it closes.
const open = (category: ArchiveCategory, id: string) => setQuery({ item: `${category}:${id}` })
const linked = computed(() => {
  const wanted = parseItem(route.query.item)
  return wanted ? entries.value.find((e) => e.category === wanted.category && e.id === wanted.id) : undefined
})
// Whether the dialog already shows this entry (a link inside it moves the url to another one, which then replaces it).
const isShown = (entry: ArchiveEntry) => shownInfo.value?.id === entry.id && shownInfo.value.kind === entry.info().kind
const selected = computed(() => (linked.value && listed.value.includes(linked.value) ? linked.value : listed.value[0]))
// Desktop shows the chosen entry in the detail pane; phones and the landing open the dialog.
const pane = useTemplateRef<HTMLElement>('pane')
const listBox = useTemplateRef<HTMLElement>('listBox')
const { wide, step } = useListPane({ selected, listed, pane, listBox, active: () => paneMode.value })
const paneMode = computed(() => wide.value && !landing.value)
const selectedInfo = computed(() => selected.value?.info())
const selectedMaker = computed(() => manufacturers.value.find((maker) => maker.id === selectedInfo.value?.source))
watch(
  [() => route.query.item, entries, paneMode],
  ([value]) => {
    if (!value) return
    const wanted = parseItem(value)
    if (linked.value) { if (!paneMode.value && !isShown(linked.value)) showInfo(linked.value.info()) }
    else if (!wanted || entries.value.some((e) => e.category === wanted.category)) setQuery({ item: undefined })
  },
  { immediate: true },
)
watch(shownInfo, (info) => { if (!info && route.query.item && !paneMode.value) setQuery({ item: undefined }) })
</script>

<template>
  <main class="page archives list-pane">
    <PageHeader title="Archives" summary="Every manufacturer, licence, frame, weapon, system, weapon mod, piece of gear, biomod, talent and core bonus in the loaded content packs.">
      <span class="dim"><span class="num">{{ entries.length }}</span> {{ entries.length === 1 ? 'entry' : 'entries' }}</span>
    </PageHeader>
    <CatalogueNotice />

    <div class="search">
      <label class="field">
        <span>Search every category</span>
        <input ref="searchBox" v-model="query" type="search" placeholder="Name, maker or rules text" @keydown.esc="query = ''" />
      </label>
      <button v-if="query" type="button" class="small" @click="(query = ''), searchBox?.focus()">Clear</button>
    </div>

    <!-- Sticky under the top bar, one row that scrolls sideways when narrow. -->
    <div ref="bar" class="cat-bar">
      <SheetTabs v-model="view" :tabs="tabs" :counts="tabCounts" label="Archive categories" />
    </div>

    <div v-if="makerChips.length" class="maker-filter" role="group" aria-label="Filter by manufacturer">
      <button
        v-for="maker in makerChips"
        :key="maker.id"
        type="button"
        class="maker-chip"
        :class="{ chosen: chosenMakers.includes(maker.id) }"
        :style="{ '--maker': makerColour(maker) }"
        :aria-pressed="chosenMakers.includes(maker.id)"
        @click="toggleMaker(maker.id)"
      >
        <Icon v-if="makerLogo(maker)" :src="makerLogo(maker)!" />{{ maker.id }}
      </button>
    </div>

    <!-- Manufacturers: a big card each, in the corporation's colour. -->
    <template v-if="landing">
      <ul v-if="manufacturers.length" class="makers">
        <li v-for="maker in manufacturers" :key="maker.id" class="maker" :style="{ '--maker': makerColour(maker) }">
          <header class="maker-head">
            <Icon v-if="makerLogo(maker)" :src="makerLogo(maker)!" class="maker-logo" />
            <InfoButton class="maker-id" :info="() => manufacturerInfo(maker, frames)" :label="maker.name" @click="open('manufacturers', maker.id)">{{ maker.id }}</InfoButton>
            <span v-if="subtitle(maker)" class="maker-name" :class="{ glitch: GLITCHED.has(maker.id) }">{{ subtitle(maker) }}</span>
          </header>
          <RulesText v-if="MOTTOS[maker.id] ?? maker.quote" class="motto" first-line-only :html="MOTTOS[maker.id] ?? maker.quote" />
          <ul class="maker-counts">
            <li v-for="c in counts(maker)" :key="c.made">
              <!-- A zero is a plain row: a click would only open an empty list. -->
              <button v-if="c.count" type="button" class="made" @click="setQuery({ cat: c.made, maker: maker.id })">
                <span class="made-name">{{ c.made }}</span><span class="num">{{ c.count }}</span>
              </button>
              <div v-else class="made"><span class="made-name">{{ c.made }}</span><span class="num">{{ c.count }}</span></div>
            </li>
          </ul>
        </li>
      </ul>
      <p v-else class="empty">No content yet: the content packs may still be loading, or none are imported.</p>
    </template>

    <!-- Everything else: the list (a box per manufacturer or gear type, licence sub-headings for weapons and systems)
         and, on desktop, the chosen entry's full information beside it. -->
    <div v-else-if="listed.length" class="browser">
      <nav ref="listBox" class="list" aria-label="Entries" @keydown="step">
        <section v-for="block in blocks" :key="block.name" class="block">
          <h2 v-if="block.name" class="sheet-label">{{ block.name }}<span class="num dim count">{{ block.count }}</span></h2>
          <section v-for="group in block.groups" :key="group.key" class="group" :class="{ branded: group.logo || group.colour !== 'var(--lilac)' }" :style="{ '--mf': group.colour }">
            <header v-if="group.title" class="group-head">
              <Icon v-if="group.logo" :src="group.logo" class="group-logo" />
              <h3>{{ group.title }}</h3>
              <span class="num dim count">{{ group.entries.length }}</span>
            </header>
            <template v-for="section in group.sections" :key="section.licence">
              <h4 v-if="section.licence || group.sections.length > 1" class="label licence">{{ section.licence ? `${section.licence} licence` : 'No licence' }}</h4>
              <ul class="rows">
                <li v-for="entry in section.entries" :key="key(entry)">
                  <button
                    type="button"
                    class="row"
                    :aria-current="paneMode && entry === selected ? 'true' : undefined"
                    @click="open(entry.category, entry.id)"
                  >
                    <span class="row-name">{{ entry.name }}</span>
                    <span v-if="listFacts(entry).length" class="row-facts sep">
                      <span v-for="fact in listFacts(entry)" :key="fact">{{ fact }}</span>
                    </span>
                  </button>
                </li>
              </ul>
            </template>
          </section>
        </section>
      </nav>
      <article v-if="paneMode && selectedInfo" ref="pane" class="pane" :style="selectedMaker ? { '--mf': makerColour(selectedMaker) } : undefined" aria-live="polite">
        <header class="pane-head">
          <Icon v-if="makerLogo(selectedMaker)" :src="makerLogo(selectedMaker)!" class="pane-logo" />
          <div>
            <p class="label">{{ selectedInfo.kind }}</p>
            <h2>{{ selectedInfo.name }}</h2>
          </div>
        </header>
        <InfoBody :info="selectedInfo" />
      </article>
    </div>
    <p v-else-if="searching" class="empty" role="status">Nothing matches that search.</p>
    <!-- The catalogues don't say when they've finished loading, so "nothing at all" can mean either. -->
    <p v-else-if="entries.length" class="empty">Nothing in this category in the loaded content packs.</p>
    <p v-else class="empty">No content yet: the content packs may still be loading, or none are imported.</p>
  </main>
</template>

<style scoped>
.archives {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
}

/* The column's gap already spaces the header from the search. */
.archives > .page-header {
  margin-bottom: 0;
}

/* The categories (SheetTabs, one row that scrolls sideways): sticky under the top bar, with the page's background so
   rows don't show through. */
.cat-bar {
  position: sticky;
  top: var(--topbar-h);
  z-index: 2;
  margin-block: calc(-1 * var(--space-s));
  background: var(--void);
}

/* The manufacturer filter: quiet chips, a chosen one tinted in its colour. */
.maker-filter {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
}

.maker-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.25rem;
  padding: 0.2rem 0.7rem;
  border-color: var(--rule);
  color: var(--text-dim);
  font-size: 0.875rem;
}

.maker-chip:hover,
.maker-chip:focus-visible {
  border-color: var(--maker);
  color: var(--text);
}

.maker-chip.chosen {
  border-color: var(--maker);
  background: color-mix(in srgb, var(--maker) 22%, transparent);
  color: var(--maker);
  font-weight: 700;
}

/* --- Manufacturer cards: the corporation's code large in its colour, its name, its motto, and shortcuts to what
   it makes. Tinted, not filled, so they stay calm next to the rest of the site. --- */
/* Cards wrap in centred rows, so a short last row sits in the middle. */
.makers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.maker {
  flex: 0 1 26rem;
  display: flex;
  flex-direction: column;
  border: 1px solid color-mix(in srgb, var(--maker) 45%, var(--rule));
  border-top: 4px solid var(--maker);
  background: color-mix(in srgb, var(--maker) 7%, transparent);
  text-align: center;
}

.maker-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: var(--space-m) var(--space-m) var(--space-s);
  border-bottom: 1px solid color-mix(in srgb, var(--maker) 30%, var(--rule));
  background: color-mix(in srgb, var(--maker) 14%, transparent);
}

.maker-logo {
  color: var(--maker);
  font-size: 4.5rem;
}

.maker-id {
  color: var(--maker);
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1.1;
}

.maker:hover,
.maker:focus-within {
  border-color: var(--maker);
}

.maker-name {
  color: var(--text);
  font-size: 0.8125rem;
  letter-spacing: 0.12em;
}

.motto {
  padding: var(--space-s) var(--space-m) 0;
  color: var(--text-dim);
  font-size: 0.9375rem;
  font-style: italic;
}

/* Rows like the content page's counts: the category's name left in the maker's colour, the number right, a thin
   rule above each (the first parts the list from the motto). The list sits at the card's foot, so cards in a row line
   up. A row is a button, except a zero, which looks the same but isn't clickable. */
.maker-counts {
  margin: auto 0 0;
  padding: var(--space-s) var(--space-m) var(--space-m);
  list-style: none;
}

.maker-counts li {
  border-top: 1px solid color-mix(in srgb, var(--maker) 30%, var(--rule));
}

.made {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-m);
  width: 100%;
  min-height: var(--tap);
  padding: var(--space-xs) var(--space-s);
  border: 0;
  border-radius: 0;
  background: none;
  color: var(--text);
  text-align: left;
}

.made-name {
  color: var(--maker);
  font-size: var(--fs-s);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.made .num {
  font-weight: 700;
}

button.made:hover,
button.made:focus-visible {
  background: color-mix(in srgb, var(--lilac) 8%, transparent);
}

button.made:hover .made-name,
button.made:focus-visible .made-name {
  color: var(--lilac);
}

/* --- A category: the list on the left (22rem) and the chosen entry's pane beside it, each sticky under the top bar
   and the tabs and scrolling on its own. Phones: the list alone, in the page. --- */
.browser {
  --stick: calc(var(--topbar-h) + var(--tabs-h) + 1px + var(--space-m));
  display: grid;
  grid-template-columns: 22rem minmax(0, 1fr);
  align-items: start;
  gap: var(--space-l);
}

.list {
  display: grid;
  gap: var(--space-l);
  padding-right: 2px; /* room for the focus ring beside the scrollbar */
}

.block {
  display: grid;
  gap: var(--space-s);
}

.block > .sheet-label {
  margin: 0;
}

.count {
  margin-left: var(--space-s);
  font-weight: 400;
  letter-spacing: 0;
}

.group.branded {
  border-top: 3px solid var(--mf);
}

.group-logo {
  width: 22px;
  height: 22px;
  color: var(--mf);
}

.group-head h3 {
  margin: 0;
  font-size: var(--fs-s);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.group-head .count {
  margin-left: auto;
}

.licence {
  margin: 0;
  padding: var(--space-s) var(--space-m) var(--space-xs);
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

.row-name {
  font-size: var(--fs-s);
  font-weight: 700;
}

/* The pane: the entry's head (its maker's logo, kind and name) over its full information, on a panel whose top border
   takes the maker's colour, as the dialog's does. */
.pane {
  --mf: var(--rule);
  display: grid;
  align-content: start;
  gap: var(--space-l);
  padding: var(--space-l);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--mf);
  border-radius: var(--radius);
  background: var(--panel);
}

.pane-head {
  display: flex;
  align-items: center;
  gap: var(--space-m);
}

.pane-logo {
  width: 32px;
  height: 32px;
  color: var(--mf);
}

.pane-head .label,
.pane-head h2 {
  margin: 0;
}

.pane-head h2 {
  font-size: var(--fs-l);
  overflow-wrap: anywhere;
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
}
</style>
