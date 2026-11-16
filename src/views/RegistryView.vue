<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import PilotCard from '../components/PilotCard.vue'
import { fetchPilots, pilotMatches, type PublicPilot } from '../pilots'

// A grid of pilot cards with one status (route meta.status): the registry shows approved pilots, pending the
// new pilots waiting on a GM, the memorial dead pilots. Cards hold public info only, so every logged-in user
// sees them. The search filters the loaded cards (pilotMatches in src/pilots.ts).
const route = useRoute()
const pilots = shallowRef<PublicPilot[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const shown = computed(() => pilots.value.filter((pilot) => pilotMatches(pilot, query.value)))

watch(
  () => route.meta.status,
  async (status) => {
    loading.value = true
    ;({ pilots: pilots.value, error: error.value } = await fetchPilots(status ?? 'approved'))
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

    <p v-if="loading" class="dim">Loading pilots…</p>
    <p v-else-if="error" class="notice warn" role="alert">Couldn't load the pilots: {{ error }}</p>
    <p v-else-if="!pilots.length" class="empty">{{ route.meta.empty }}</p>
    <template v-else>
      <div class="search">
        <label class="field">
          <span>Search</span>
          <input v-model="query" type="search" placeholder="Callsign, name, player or mech" @keydown.esc="query = ''" />
        </label>
        <p v-if="query.trim()" class="dim" role="status"><span class="num">{{ shown.length }}</span> of <span class="num">{{ pilots.length }}</span> pilots</p>
      </div>
      <p v-if="!shown.length" class="empty">No pilots match that search.</p>
      <ul v-else class="card-grid">
        <li v-for="pilot in shown" :key="pilot.id">
          <PilotCard
            :to="{ name: 'pilot-record', params: { id: pilot.id } }"
            :image="pilot.pilot_image"
            :callsign="pilot.callsign"
            :name="pilot.pilot_name"
            :mechs="pilot.mechs.map((mech) => mech.name).join(', ')"
            :player="pilot.player?.display_name"
            :dead="pilot.status === 'dead'"
          />
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
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
