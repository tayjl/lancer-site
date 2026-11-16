<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InfoButton from '../components/InfoButton.vue'
import PageHeader from '../components/PageHeader.vue'
import RulesText from '../components/RulesText.vue'
import SheetTabs from '../components/SheetTabs.vue'
import Icon from '../components/Icon.vue'
import {
  ARCHIVE_CATEGORIES, MAKER_CATEGORIES, archiveEntries, archiveGroups, filterByMakers, makerColour, makerLogo, parseItem, parseMakers,
  searchArchive, useManufacturers, type ArchiveCategory, type ArchiveEntry, type ArchiveGroup,
} from '../archive'
import { tagNames, useGameData } from '../gameData'
import { manufacturerInfo, showInfo, shownInfo, type Manufacturer } from '../info'
import { itemDetails } from '../itemDetails'
import { mechStats, useMechData, type Frame } from '../mechData'
import { rankName } from '../rules'

// The archives, like COMP/CON's compendium: pick a category from the sticky row of options to browse it, or search
// every category at once. Each entry is one compact row with its key facts in aligned columns; the row opens its full
// information (InfoDialog.vue). Styled by corporation: manufacturers are cards in their own colour, and everything
// they make (licences, core bonuses, frames, weapons, systems) is listed in a box in that colour.
const { frames, weapons, systems } = useMechData()
const { gear, talents, coreBonuses } = useGameData()
const manufacturers = useManufacturers()

const entries = computed(() =>
  archiveEntries({
    manufacturers: manufacturers.value,
    frames: frames.value,
    weapons: weapons.value,
    systems: systems.value,
    gear: gear.value,
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

// What's listed: one block of maker boxes for a category; across every category, a block per category with a
// heading and its best matches first. Each section's entries come with their row's cells (rowOf, below) and the
// section's layout (all its rows share one).
const withRows = (groups: ArchiveGroup[]) =>
  groups.map((group) => ({
    ...group,
    sections: group.sections.map((section) => {
      const items = section.entries.map((entry) => ({ entry, row: rowOf(entry) }))
      return { licence: section.licence, layout: items[0]?.row.layout ?? '', items }
    }),
  }))
const blocks = computed(() => {
  const list = shown.value.filter(inView)
  if (view.value !== 'all') return [{ name: '', count: list.length, groups: withRows(archiveGroups(list, manufacturers.value)) }]
  return ARCHIVE_CATEGORIES.map((name) => list.filter((entry) => entry.category === name))
    .filter((matches) => matches.length)
    .map((matches) => ({ name: matches[0].category, count: matches.length, groups: withRows(archiveGroups(matches, manufacturers.value, true)) }))
})

// A manufacturer card's counts, each a shortcut to that category. Licences always show, even "0 licences" (GMS
// sells no licences), so every card has the same row; the rest only when there are some.
const MADE: ArchiveCategory[] = ['licences', 'frames', 'mech weapons', 'mech systems', 'core bonuses']
// The category's name, made singular for one ("1 mech weapon").
const ONE: Partial<Record<ArchiveCategory, string>> = {
  licences: 'licence', frames: 'frame', 'mech weapons': 'mech weapon', 'mech systems': 'mech system', 'core bonuses': 'core bonus',
}
const counts = (maker: Manufacturer) =>
  MADE.map((made) => ({ made, count: entries.value.filter((entry) => entry.category === made && entry.group === maker.id).length }))
    .filter((c) => c.count || c.made === 'licences')
    .map((c) => ({ ...c, label: c.count === 1 ? ONE[c.made]! : c.made }))

// One row's cells. Every row of a layout has the same cells (some empty), so its columns line up across boxes.
type Stat = { label: string; value: string; icon: string | null }
type Fact = { text?: string; tag?: string; rose?: boolean; stats?: Stat[]; named?: boolean }
type Row = { layout: string; rank?: string; facts: Fact[]; sp?: string; tags?: string[]; summary?: string }
const ARMOUR_STATS = ['hp', 'armour', 'e-defense', 'speed']
const FRAME_STATS = ['hp', 'armour', 'evasion', 'e-defence', 'speed', 'heat cap', 'system points']
const frameStats = (frame: Frame): Stat[] => {
  const stats = mechStats(frame, undefined, [])
  return FRAME_STATS.flatMap((name) => stats.filter((stat) => stat.name === name)).map((stat) => ({ label: stat.name, value: String(stat.value ?? '-'), icon: stat.icon ?? null }))
}
const half = (value?: number) => (value === 0.5 ? '½' : String(value ?? '-'))
function rowOf(entry: ArchiveEntry): Row {
  const { item, frame } = entry
  if (item) {
    const details = itemDetails(item, tagNames.value)
    const stats = (kind: string) => details.stats.filter((stat) => stat.kind === kind)
    const rank = entry.level ? rankName(entry.level).toLowerCase() : ''
    const sp = item.sp ? `${item.sp} sp` : ''
    const range: Fact = { stats: stats('range') }
    const damage: Fact = { stats: stats('damage'), named: true }
    if (entry.category === 'mech weapons') return { layout: 'weapons', rank, facts: [{ text: `${item.mount} ${item.type}`.toLowerCase() }, range, damage], sp, tags: details.tags }
    if (entry.category === 'mech systems') return { layout: 'systems', rank, facts: [{ text: (item.type || 'system').toLowerCase() }], sp, tags: details.tags, summary: entry.summary }
    // Armour's stats each in their own column (hp, armour, e-defence, speed; pilots have no evasion).
    if (item.type === 'Armor') return { layout: 'armour', facts: ARMOUR_STATS.map((label) => ({ stats: stats('bonus').filter((stat) => stat.label === label) })) }
    if (item.type === 'Weapon') return { layout: 'gear-weapons', facts: [range, damage], tags: details.tags }
    return { layout: 'gear', facts: [], tags: details.tags, summary: entry.summary }
  }
  if (entry.category === 'frames' && frame)
    return {
      layout: 'frames',
      facts: [
        { text: frame.mechtype.join(' / ').toLowerCase(), rose: true },
        { text: `size ${half(frame.stats.size)}` },
        { text: frame.mounts.join(', ').toLowerCase() },
        { stats: frameStats(frame) },
      ],
    }
  if (entry.unlocks) return { layout: 'licences', facts: entry.unlocks.map((names, i) => ({ tag: rankName(i + 1).toLowerCase(), text: names.join(', ') || '-' })) }
  return { layout: 'text', facts: [], summary: entry.summary }
}
const key = (entry: ArchiveEntry) => `${entry.category}:${entry.id}`
// A small header over the layouts whose columns are symbols or bare numbers (hidden on phones). A list is the
// frame's stat strip, one name per stat slot.
const COLUMN_HEADS: Record<string, (string | string[])[]> = {
  frames: ['role', 'size', 'mounts', ['hp', 'armour', 'evasion', 'e-def', 'speed', 'heat cap', 'sp']],
  armour: ['hp', 'armour', 'e-defence', 'speed'],
}

// The open entry lives in the url (?item=), so it can be linked. A link opens once its catalogue has loaded (they
// don't say when they're done, so this watches the entries); one that isn't there once its category has loaded,
// or isn't a link at all, is dropped. Closing the dialog drops it too. Only entries opened here go in the url.
const open = (category: ArchiveCategory, id: string) => setQuery({ item: `${category}:${id}` })
watch(
  [() => route.query.item, entries],
  ([value]) => {
    if (!value) return
    const wanted = parseItem(value)
    const entry = wanted && entries.value.find((e) => e.category === wanted.category && e.id === wanted.id)
    if (entry) { if (!shownInfo.value) showInfo(entry.info()) }
    else if (!wanted || entries.value.some((e) => e.category === wanted.category)) setQuery({ item: undefined })
  },
  { immediate: true },
)
watch(shownInfo, (info) => { if (!info && route.query.item) setQuery({ item: undefined }) })
</script>

<template>
  <main class="page archives">
    <PageHeader title="archives" summary="every manufacturer, licence, frame, weapon, system, piece of gear, talent and core bonus in the loaded content packs.">
      <span class="dim">{{ entries.length }} entries</span>
    </PageHeader>

    <div class="search">
      <label class="field">
        <span>search every category</span>
        <input ref="searchBox" v-model="query" type="search" placeholder="name, maker or rules text" @keydown.esc="query = ''" />
      </label>
      <button v-if="query" type="button" class="small" @click="(query = ''), searchBox?.focus()">clear</button>
    </div>

    <!-- Sticky under the top bar, one row that scrolls sideways when narrow. -->
    <div ref="bar" class="cat-bar">
      <SheetTabs v-model="view" :tabs="tabs" :counts="tabCounts" label="archive categories" />
    </div>

    <div v-if="makerChips.length" class="maker-filter" role="group" aria-label="filter by manufacturer">
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
          <RulesText v-if="MOTTOS[maker.id] ?? maker.quote" class="motto" :html="MOTTOS[maker.id] ?? maker.quote" />
          <ul class="maker-counts">
            <li v-for="c in counts(maker)" :key="c.made">
              <button type="button" @click="view = c.made"><b>{{ c.count }}</b> {{ c.label }}</button>
            </li>
          </ul>
        </li>
      </ul>
      <p v-else class="empty">no content yet: the content packs may still be loading, or none are imported.</p>
    </template>

    <!-- Everything else: a box per manufacturer (or gear type), its rows by licence for weapons and systems. -->
    <template v-else-if="shown.some(inView)">
      <section v-for="block in blocks" :key="block.name" class="block">
        <h2 v-if="block.name" class="sheet-label">{{ block.name }}<span class="tag">{{ ` ${block.count}` }}</span></h2>
        <section v-for="group in block.groups" :key="group.key" class="band" :style="{ '--maker': group.colour }">
          <header v-if="group.title" class="band-head">
            <Icon v-if="group.logo" :src="group.logo" class="band-logo" />
            <h3 class="band-title">{{ group.title }}</h3>
            <span class="band-count">{{ group.entries.length }}</span>
          </header>
          <template v-for="section in group.sections" :key="section.licence">
            <h4 v-if="section.licence || group.sections.length > 1" class="licence">
              {{ section.licence || 'no licence' }}<span v-if="section.licence" class="dim"> licence</span>
            </h4>
            <!-- Screen readers get each stat's name in its row instead. -->
            <div v-if="COLUMN_HEADS[section.layout]" class="col-heads" :class="section.layout" aria-hidden="true">
              <span></span>
              <span v-for="(head, i) in COLUMN_HEADS[section.layout]" :key="i" class="c-fact">
                <template v-if="Array.isArray(head)"><span v-for="name in head" :key="name" class="stat">{{ name }}</span></template>
                <template v-else>{{ head }}</template>
              </span>
            </div>
            <ul class="rows">
              <li v-for="{ entry, row } in section.items" :key="key(entry)" class="row" :class="row.layout">
                <InfoButton class="c-name" :info="entry.info" :label="entry.name" @click="open(entry.category, entry.id)" />
                <span v-if="row.rank !== undefined" class="c-rank">{{ row.rank }}</span>
                <span class="c-facts">
                  <span v-for="(fact, i) in row.facts" :key="i" class="c-fact" :class="{ rose: fact.rose }">
                    <span v-if="fact.tag" class="rank-tag">{{ fact.tag }}</span>
                    {{ fact.text }}
                    <span v-for="stat in fact.stats" :key="stat.label" class="stat" :title="stat.label">
                      <Icon v-if="stat.icon" :src="stat.icon" />
                      <span :class="{ 'sr-only': !fact.named }">{{ stat.label }}</span>
                      {{ stat.value }}
                    </span>
                  </span>
                </span>
                <span v-if="row.sp !== undefined" class="c-sp">{{ row.sp }}</span>
                <ul v-if="row.tags" class="c-tags">
                  <li v-for="tag in row.tags" :key="tag">{{ tag }}</li>
                </ul>
                <span v-if="row.summary !== undefined" class="c-sum">{{ row.summary }}</span>
              </li>
            </ul>
          </template>
        </section>
      </section>
    </template>
    <p v-else-if="searching" class="empty" role="status">nothing matches that search.</p>
    <!-- The catalogues don't say when they've finished loading, so "nothing at all" can mean either. -->
    <p v-else-if="entries.length" class="empty">nothing in this category in the loaded content packs.</p>
    <p v-else class="empty">no content yet: the content packs may still be loading, or none are imported.</p>
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

/* The search: a wide field centred above everything, with its clear button level with the box. */
.search {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--space-s);
}

.search .field {
  flex: 0 1 36rem;
}

.search input {
  width: 100%;
  font-size: 1rem;
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
  justify-content: center;
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

/* Even columns, not wrapped flex: every card has the same width and the same five counts, so they all break into the
   same rows. (Wrapped by text width, GMS's short "0 licences" and "1 frame" fitted on one row fewer, and the
   auto margin pushing the buttons to the card's foot left a gap under its motto that the other cards didn't have.) */
.maker-counts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
  gap: 0.25rem var(--space-s);
  margin: auto 0 0;
  padding: var(--space-s) var(--space-m) var(--space-m);
  list-style: none;
}

.maker-counts button {
  width: 100%;
  white-space: nowrap;
  min-height: 2rem;
  padding: 0.3rem 0.65rem;
  color: var(--maker);
  font-size: 0.875rem;
}

.maker-counts button:hover,
.maker-counts button:focus-visible {
  color: var(--rose);
}

/* --- Lists: across every category, a heading per category (its count in sky); then a box per manufacturer, its
   header tinted in that colour with the logo, code and count; licence sub-headings; then the rows. --- */
.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
}

.block > .sheet-label {
  margin: 0;
}

.sheet-label .tag {
  color: var(--sky);
}

.sheet-label .tag::before {
  content: none;
}

.band {
  border: 1px solid color-mix(in srgb, var(--maker) 40%, var(--rule));
}

.band-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.75rem;
  background: color-mix(in srgb, var(--maker) 14%, transparent);
}

.band-logo {
  color: var(--maker);
  font-size: 1.5rem;
}

.band-title {
  margin: 0;
  color: var(--maker);
  font-size: 1.125rem;
}

.band-count {
  color: var(--sky);
  font-size: 0.8125rem;
}

.licence {
  margin: 0;
  padding: 0.4rem 0.75rem 0.1rem;
  border-top: 1px solid var(--rule);
  color: var(--maker);
  font-size: 0.875rem;
}

.licence .dim {
  font-weight: 400;
}

/* The column names over frames and pilot armour: small and dim, on the rows' grid. */
.col-heads {
  display: grid;
  gap: 0 1rem;
  padding: 0.2rem 0.75rem;
  color: var(--text-dim);
  font-size: 0.6875rem;
}

.col-heads .c-fact,
.col-heads .stat {
  color: inherit;
}

/* --- Rows: left-aligned, one per entry, in a grid with one column template per layout so values line up. The whole
   row opens the entry: the name's button is stretched over it. --- */
.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  position: relative;
  display: grid;
  align-items: baseline;
  gap: 0.25rem 1rem;
  padding: 0.3rem 0.75rem;
  border-top: 1px solid var(--rule);
  font-size: 0.875rem;
  line-height: 1.4;
}

.licence + .rows > .row:first-child {
  border-top: 0;
}

.row:hover,
.row:focus-within {
  background: color-mix(in srgb, var(--maker) 10%, var(--raised));
}

.row:has(:focus-visible) {
  outline: 2px solid var(--lilac);
  outline-offset: -2px;
}

.c-name {
  color: var(--text);
  font-size: 0.9375rem;
  font-weight: 700;
  text-decoration: none;
}

.row:hover .c-name,
.c-name:focus-visible {
  color: var(--maker);
}

.c-name::after {
  content: '';
  position: absolute;
  inset: 0;
}

.c-name:focus-visible {
  outline: none;
}

.c-facts {
  display: contents;
}

.c-fact {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.15rem 0.6rem;
  color: var(--text-dim);
}

/* A licence rank: its numeral in its own column, the names wrapping beside it (a hanging indent). */
.licences .c-fact {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  align-items: baseline;
}

.c-fact.rose {
  color: var(--rose);
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text);
}

.stat .icon {
  color: var(--lilac);
}

.c-rank,
.rank-tag {
  color: var(--sky);
}


.c-sp {
  color: var(--text-dim);
}

.c-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.c-tags li {
  padding: 0 0.35rem;
  border: 1px solid var(--rule);
  color: var(--sky);
  font-size: 0.75rem;
}

.c-sum {
  min-width: 0;
  overflow: hidden;
  color: var(--text-dim);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.weapons { grid-template-columns: minmax(10rem, 1.2fr) 1.5rem 9.5rem 7rem 10rem 3rem minmax(0, 1.5fr); }
.systems { grid-template-columns: minmax(10rem, 1.2fr) 1.5rem 7rem 3rem minmax(0, 1fr) minmax(0, 1.8fr); }
.frames { grid-template-columns: minmax(8rem, 0.8fr) 11.5rem 3.5rem 11rem minmax(0, 2fr); }
/* A frame's stats in slots of one width, so each stat sits under the same stat in the row above (and its name). */
.frames .c-fact { column-gap: 0; }
.frames .stat { min-width: 3.5rem; }
.licences { grid-template-columns: minmax(8rem, 0.8fr) repeat(3, minmax(0, 2fr)); }
.text { grid-template-columns: minmax(10rem, 1fr) minmax(0, 3.5fr); }
.armour { grid-template-columns: minmax(10rem, 1fr) repeat(4, 4rem) minmax(0, 2.5fr); }
.gear-weapons { grid-template-columns: minmax(10rem, 1fr) 7.5rem 8rem minmax(0, 2.3fr); }
.gear { grid-template-columns: minmax(10rem, 1fr) minmax(0, 1fr) minmax(0, 2.5fr); }

/* Tablets and small laptops: a weapon's tags and a system's summary move under its row. */
@media (max-width: 72rem) {
  .weapons { grid-template-columns: minmax(9rem, 1fr) 1.5rem 9.5rem 6.5rem 10rem 3rem; }
  .systems { grid-template-columns: minmax(9rem, 1fr) 1.5rem 6.5rem 3rem minmax(0, 1.5fr); }
  .frames { grid-template-columns: minmax(6rem, 1fr) 9rem 3.25rem 8rem auto; }
  .weapons .c-tags,
  .systems .c-sum { grid-column: 1 / -1; }
}

/* Phones and narrow windows: each row stacks. The name with its rank and sp, then the facts and tags, then the
   summary. The name leaves just enough room for rank and sp, so everything after them starts a new line. */
@media (max-width: 56rem) {
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.75rem;
  }

  .col-heads { display: none; }
  .c-name { flex: 1 1 calc(100% - 7rem); min-width: 0; }
  .row:not(:has(.c-rank)) .c-name { flex-basis: 100%; }
  .c-rank, .c-sp { order: 1; }
  .c-fact { order: 2; }
  .c-fact:empty { display: none; }
  .c-tags { order: 3; }
  .c-sum { order: 4; flex-basis: 100%; }
  .licences .c-fact { flex-basis: 100%; }
  .frames .stat { min-width: 0; }
}
</style>
