<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import PilotIdCard from '../components/PilotIdCard.vue'
import { displayColour } from '../pilotColour'
import { fetchPilotCards, pilotMatches, type PilotCardRow } from '../pilots'

// A grid of pilot ID cards (PilotIdCard.vue, no download or save here) with one status (route meta.status): the registry
// shows approved pilots, pending the new pilots waiting on a GM, the memorial dead pilots. Cards hold public info only,
// so every logged-in user sees them. Each card links to the record. The search filters the loaded cards (pilotMatches
// in src/pilots.ts).
const route = useRoute()
const pilots = shallowRef<PilotCardRow[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const shown = computed(() => pilots.value.filter((pilot) => pilotMatches(pilot, query.value)))

watch(
  () => route.meta.status,
  async (status) => {
    loading.value = true
    ;({ pilots: pilots.value, error: error.value } = await fetchPilotCards(status ?? 'approved'))
    loading.value = false
  },
  { immediate: true },
)
</script>

<template>
  <main class="page">
    <PageHeader :title="String(route.meta.title)" :summary="route.meta.summary">
      <span v-if="!loading && !error && pilots.length" class="dim"><span class="num">{{ pilots.length }}</span> {{ pilots.length === 1 ? 'pilot' : 'pilots' }}</span>
    </PageHeader>

    <p v-if="loading" class="dim">Loading…</p>
    <p v-else-if="error" class="notice warn" role="alert">Pilots didn't load: {{ error }}</p>
    <p v-else-if="!pilots.length" class="empty">{{ route.meta.empty }}</p>
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
/* Showcase cards, so the group and each card's player line are centred: one to a row on phones, two or three on desktop. */
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
  margin-inline: auto;
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
  text-align: center;
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
