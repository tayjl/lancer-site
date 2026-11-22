<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import PilotIdCard from '../components/PilotIdCard.vue'
import SheetTabs from '../components/SheetTabs.vue'
import { displayColour } from '../pilotColour'
import { fetchPilotCards, pilotMatches, type PilotCardRow } from '../pilots'

// A grid of pilot ID cards (PilotIdCard.vue, no download or save here) for one list, chosen by the tabs and kept in the
// url (?list=): approved pilots, the new pilots waiting on a GM (pending), or the dead (memorial). Cards hold public info
// only, so every logged-in user sees them. Each card links to the record. The search filters the loaded cards (pilotMatches
// in src/pilots.ts).
const LISTS = {
  approved: { label: 'Approved', status: 'approved', summary: 'Every approved pilot.', empty: 'No approved pilots yet.' },
  pending: { label: 'Pending', status: 'pending', summary: 'New pilots waiting on a GM.', empty: 'No pending pilots.' },
  memorial: { label: 'Memorial', status: 'dead', summary: 'Pilots who died.', empty: 'No dead pilots.' },
} as const
const tabLabels = Object.values(LISTS).map((l) => l.label)

const route = useRoute()
const router = useRouter()
const key = computed(() => (route.query.list === 'pending' || route.query.list === 'memorial' ? route.query.list : 'approved'))
const list = computed(() => LISTS[key.value])
// Replace, not push, so Back leaves the page instead of walking through the tabs.
const tab = computed({
  get: () => list.value.label,
  set: (label) => {
    const next = (Object.keys(LISTS) as (keyof typeof LISTS)[]).find((k) => LISTS[k].label === label)!
    router.replace({ query: { ...route.query, list: next === 'approved' ? undefined : next } })
  },
})
const pilots = shallowRef<PilotCardRow[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const shown = computed(() => pilots.value.filter((pilot) => pilotMatches(pilot, query.value)))

watch(
  () => list.value.status,
  async (status) => {
    loading.value = true
    const result = await fetchPilotCards(status)
    if (status !== list.value.status) return // A newer list was chosen while this loaded.
    ;({ pilots: pilots.value, error: error.value } = result)
    loading.value = false
  },
  { immediate: true },
)
</script>

<template>
  <main class="page">
    <PageHeader title="Pilot registry" :summary="list.summary">
      <span v-if="!loading && !error && pilots.length" class="dim"><span class="num">{{ pilots.length }}</span> {{ pilots.length === 1 ? 'pilot' : 'pilots' }}</span>
    </PageHeader>
    <SheetTabs v-model="tab" :tabs="tabLabels" label="Pilot lists" class="list-tabs" />

    <p v-if="loading" class="dim">Loading…</p>
    <p v-else-if="error" class="notice warn" role="alert">Pilots didn't load: {{ error }}</p>
    <p v-else-if="!pilots.length" class="empty">{{ list.empty }}</p>
    <template v-else>
      <div class="search">
        <label class="field">
          <span>Search</span>
          <input v-model="query" type="search" placeholder="Callsign, name or player" @keydown.esc="query = ''" />
        </label>
        <p v-if="query.trim()" class="dim" role="status"><span class="num">{{ shown.length }}</span> of <span class="num">{{ pilots.length }}</span> pilots</p>
      </div>
      <p v-if="!shown.length" class="empty">Nothing matches that search.</p>
      <ul v-else class="id-grid">
        <li v-for="pilot in shown" :key="pilot.id">
          <RouterLink :to="{ name: 'pilot-record', params: { id: pilot.id } }" class="id-link">
            <PilotIdCard
              :id="pilot.id"
              :callsign="pilot.callsign"
              :name="pilot.pilot_name"
              :status="pilot.status"
              :approved-at="pilot.approved_at"
              :level="pilot.level"
              :licence-level="pilot.licence_level"
              :portrait="pilot.pilot_image"
              :colour="displayColour(pilot.colour)"
              :medals="pilot.medals"
            />
          </RouterLink>
          <p class="dim">{{ pilot.player_name ? `Player: ${pilot.player_name}` : 'Unknown player' }}</p>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.list-tabs {
  margin: calc(-1 * var(--space-s)) 0 var(--space-l);
}

/* Cards line up with the title and search on the left, with each player line under its card: one to a row on phones, two or three on desktop. */
.id-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
  gap: var(--space-l) var(--space-m);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* The card itself is the link, with no panel around it: hover lights its edge lilac (the glow follows the cut corners),
   focus adds the usual ring. content-visibility skips drawing cards off screen (each is an SVG with a blur filter). */
.id-link {
  display: block;
  max-width: 36rem;
  color: inherit;
  text-decoration: none;
  content-visibility: auto;
  contain-intrinsic-size: auto 20rem;
}

.id-link .panel {
  padding: 0;
  border: 0;
  background: none;
}

.id-link:hover,
.id-link:focus-visible {
  filter: drop-shadow(0 0 3px var(--lilac));
}

.id-grid p {
  margin: var(--space-xs) 0 0;
  font-size: var(--fs-s);
}

.search {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-s) var(--space-m);
  margin-bottom: var(--space-l);
}

.search .field {
  flex: 0 1 28rem;
}

.search p {
  margin: 0;
  padding-bottom: var(--space-s);
}
</style>
