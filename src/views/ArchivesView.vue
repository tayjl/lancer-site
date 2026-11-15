<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InfoButton from '../components/InfoButton.vue'
import PageHeader from '../components/PageHeader.vue'
import RulesText from '../components/RulesText.vue'
import SheetTabs from '../components/SheetTabs.vue'
import StatIcon from '../components/StatIcon.vue'
import { ARCHIVE_CATEGORIES, archiveEntries, archiveGroups, makerColour, makerLogo, searchArchive, useManufacturers, type ArchiveCategory, type ArchiveEntry } from '../archive'
import { useGameData } from '../gameData'
import { manufacturerInfo, type Manufacturer } from '../info'
import { useMechData } from '../mechData'

// The archives, like COMP/CON's compendium: pick a category from the row of options (as on the pilot sheet) to
// browse it, or search every category at once. Each entry's name opens its full information (InfoDialog.vue).
// Styled by corporation: manufacturers are big cards in their own colour, and every category made by them
// (licences, core bonuses, frames, weapons, systems) is listed under a band in that colour.
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
const makers = computed(() => new Map(manufacturers.value.map((m) => [m.id, m])))
// What a card shows under the code (the full name, unless replaced here) and as its motto (the pack's quote, unless
// replaced here). HORUS has no other name, so its line under the code is a glitching greeting instead, and its
// long message is shortened.
const SUBTITLES: Record<string, string> = { HORUS: '[ CONGRATULATIONS, PILOT. ]' }
const GLITCHED = new Set(['HORUS'])
const MOTTOS: Record<string, string> = { HORUS: 'Access is yours, so long as you can keep it.' }
const subtitle = (maker: Manufacturer) => SUBTITLES[maker.id] ?? (maker.name !== maker.id ? maker.name : '')
const colourOf = (entry: ArchiveEntry) => makerColour(makers.value.get(entry.group))

// The category and the search live in the url (?cat=frames&q=goblin, defaults left out), like the pilot sheet's
// ?tab=, so reloads, back and shared links keep them. The search is a plain ref that writes to the url, so typing
// never waits on the router.
const route = useRoute()
const router = useRouter()
const category = computed<ArchiveCategory>({
  get: () => ARCHIVE_CATEGORIES.find((cat) => cat === route.query.cat) ?? 'manufacturers',
  set: (cat) => router.replace({ query: { ...route.query, cat: cat === 'manufacturers' ? undefined : cat } }),
})
const query = ref(String(route.query.q ?? ''))
const searchBox = useTemplateRef<HTMLInputElement>('searchBox')
watch(query, (q) => router.replace({ query: { ...route.query, q: q || undefined } }))
watch(() => route.query.q, (q) => (query.value = String(q ?? '')))
const tabCounts = computed(() => Object.fromEntries(ARCHIVE_CATEGORIES.map((cat) => [cat, entries.value.filter((entry) => entry.category === cat).length])))
const groups = computed(() => archiveGroups(entries.value.filter((entry) => entry.category === category.value), manufacturers.value))

// A manufacturer card's counts, each a shortcut to that category. Licences always show, even "0 licences" (GMS
// sells no licences), so every card has the same row; the rest only when there are some.
const MADE: ArchiveCategory[] = ['licences', 'frames', 'mech weapons', 'mech systems', 'core bonuses']
const counts = (maker: Manufacturer) =>
  MADE.map((made) => ({ made, count: entries.value.filter((entry) => entry.category === made && entry.group === maker.id).length }))
    .filter((c) => c.count || c.made === 'licences')

// Search results, grouped by category in the selector's order.
const results = computed(() => {
  const found = searchArchive(entries.value, query.value)
  return ARCHIVE_CATEGORIES.map((name) => ({ name, entries: found.filter((entry) => entry.category === name) })).filter((group) => group.entries.length)
})
const resultCount = computed(() => results.value.reduce((sum, group) => sum + group.entries.length, 0))
const key = (entry: ArchiveEntry) => `${entry.category}:${entry.id}`
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

    <template v-if="query.trim()">
      <p v-if="resultCount" class="count" role="status">{{ resultCount }} {{ resultCount === 1 ? 'match' : 'matches' }}</p>
      <p v-else class="empty" role="status">nothing matches that search.</p>
      <section v-for="group in results" :key="group.name">
        <h2 class="sheet-label">{{ group.name }}<span class="tag">{{ ` ${group.entries.length}` }}</span></h2>
        <ul class="entries">
          <li v-for="entry in group.entries" :key="key(entry)" class="entry" :style="{ '--maker': colourOf(entry) }">
            <span v-if="makers.has(entry.group)" class="entry-maker">{{ entry.group }}</span>
            <InfoButton class="name" :info="entry.info" :label="entry.name" />
            <span v-if="entry.meta" class="meta">{{ entry.meta }}</span>
          </li>
        </ul>
      </section>
    </template>

    <template v-else>
      <SheetTabs v-model="category" :tabs="ARCHIVE_CATEGORIES" :counts="tabCounts" label="archive categories" />

      <!-- Manufacturers: a big card each, in the corporation's colour. -->
      <ul v-if="category === 'manufacturers' && manufacturers.length" class="makers">
        <li v-for="maker in manufacturers" :key="maker.id" class="maker" :style="{ '--maker': makerColour(maker) }">
          <header class="maker-head">
            <StatIcon v-if="makerLogo(maker)" :src="makerLogo(maker)!" class="maker-logo" />
            <InfoButton class="maker-id" :info="() => manufacturerInfo(maker, frames)" :label="maker.name">{{ maker.id }}</InfoButton>
            <span v-if="subtitle(maker)" class="maker-name" :class="{ glitch: GLITCHED.has(maker.id) }">{{ subtitle(maker) }}</span>
          </header>
          <RulesText v-if="MOTTOS[maker.id] ?? maker.quote" class="motto" :html="MOTTOS[maker.id] ?? maker.quote" />
          <ul v-if="counts(maker).length" class="maker-counts">
            <li v-for="c in counts(maker)" :key="c.made">
              <button type="button" @click="category = c.made">{{ c.count }} {{ c.made }}</button>
            </li>
          </ul>
        </li>
      </ul>

      <!-- Everything else: a band per manufacturer (or gear type), then its entries as tiles in that colour. -->
      <template v-else-if="groups.length">
        <section v-for="group in groups" :key="group.key" class="band-group" :style="{ '--maker': group.colour }">
          <header v-if="group.title" class="band">
            <StatIcon v-if="group.logo" :src="group.logo" class="band-logo" />
            <span class="band-title">{{ group.title }}</span>
            <span class="band-count">{{ group.entries.length }}</span>
          </header>
          <ul class="entries">
            <li v-for="entry in group.entries" :key="key(entry)" class="entry">
              <InfoButton class="name" :info="entry.info" :label="entry.name" />
              <span v-if="entry.meta" class="meta">{{ entry.meta }}</span>
            </li>
          </ul>
        </section>
      </template>
      <!-- The catalogues don't say when they've finished loading, so "nothing at all" can mean either. -->
      <p v-else-if="entries.length" class="empty">nothing in this category in the loaded content packs.</p>
      <p v-else class="empty">no content yet: the content packs may still be loading, or none are imported.</p>
    </template>
  </main>
</template>

<style scoped>
.archives {
  display: flex;
  flex-direction: column;
  gap: var(--space-l);
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

.count {
  max-width: none;
  margin: 0;
  color: var(--sky);
  text-align: center;
}

/* Search results: the categories' counts sit where a section's tag would be, in sky rather than private's rose. */
.sheet-label .tag {
  color: var(--sky);
}

.sheet-label .tag::before {
  content: none;
}

/* --- Manufacturer cards: the corporation's code large in its colour, its name, its motto, and shortcuts to what
   it makes. Tinted, not filled, so they stay calm next to the rest of the site. --- */
/* Cards wrap in centred rows, so a short last row sits in the middle. */
.makers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
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
  gap: 0.2rem;
  padding: 1.25rem 1rem 0.75rem;
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
  padding: 1rem 1.25rem 0;
  color: var(--text-dim);
  font-size: 0.9375rem;
  font-style: italic;
}

.maker-counts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 1rem;
  margin: auto 0 0;
  padding: 1rem 1rem 1.1rem;
  list-style: none;
}

.maker-counts button {
  min-height: 2rem;
  padding: 0.3rem 0.65rem;
  color: var(--maker);
  font-size: 0.875rem;
}

.maker-counts button:hover,
.maker-counts button:focus-visible {
  color: var(--rose);
}

/* --- A band per manufacturer: its code in its colour, its name, a count, and a rule in its colour. --- */
.band-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.band {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.25rem 0.75rem;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid var(--maker);
}

.band-logo {
  align-self: center;
  color: var(--maker);
  font-size: 1.75rem;
}

.band-title {
  color: var(--maker);
  font-size: 1.5rem;
  font-weight: 700;
}

.band-count {
  color: var(--sky);
  font-size: 0.8125rem;
}

/* --- Entries: tiles with a bar in their manufacturer's colour on top and a faint tint of it. The whole tile opens
   the entry's information: the name's button is stretched over it. --- */
.entries {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  position: relative;
  flex: 0 1 16rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.6rem 0.75rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--maker) 30%, var(--rule));
  border-top: 3px solid var(--maker);
  background: color-mix(in srgb, var(--maker) 5%, transparent);
  text-align: center;
}

.entry:hover,
.entry:focus-within {
  border-color: var(--maker);
  background: color-mix(in srgb, var(--maker) 12%, var(--raised));
}

.entry:has(:focus-visible) {
  outline: 2px solid var(--lilac);
  outline-offset: 2px;
}

.entry :deep(.name)::after {
  content: '';
  position: absolute;
  inset: 0;
}

.entry :deep(.name):focus-visible {
  outline: none;
}

.entry-maker {
  color: var(--maker);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.name {
  color: var(--text);
  font-weight: 700;
}

.meta {
  color: var(--text-dim);
  font-size: 0.8125rem;
}

/* Phones: two tiles to a row. */
@media (max-width: 40rem) {
  .entry {
    flex-basis: calc(50% - var(--space-s) / 2);
    padding-inline: var(--space-s);
  }
}
</style>
