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
      <span v-if="!loading && !error && pilots.length" class="dim">{{ pilots.length }} {{ pilots.length === 1 ? 'pilot' : 'pilots' }}</span>
    </PageHeader>

    <p v-if="loading" class="dim loading">loading records...</p>
    <p v-else-if="error" class="notice warn" role="alert">couldn't load the pilots: {{ error }}</p>
    <p v-else-if="!pilots.length" class="empty">{{ route.meta.empty }}</p>
    <template v-else>
      <div class="search">
        <label class="field">
          <span>search pilots</span>
          <input v-model="query" type="search" placeholder="callsign, name, player or mech" @keydown.esc="query = ''" />
        </label>
        <p v-if="query.trim()" class="count" role="status">{{ shown.length }} of {{ pilots.length }} pilots</p>
      </div>
      <p v-if="!shown.length" class="empty">no pilots match that search.</p>
      <ul v-else class="grid">
        <li v-for="pilot in shown" :key="pilot.id"><PilotCard :pilot="pilot" /></li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.loading {
  max-width: none;
  text-align: center;
}

.search {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: center;
  gap: var(--space-s) var(--space-m);
  margin-bottom: var(--space-l);
}

.search .field {
  flex: 0 1 28rem;
}

.search input {
  width: 100%;
}

.count {
  margin: 0;
  padding-bottom: var(--space-s);
  color: var(--sky);
}

/* Cards as many to a row as fit, centred, so a short list sits in the middle. Two to a row on phones. */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 13rem));
  justify-content: center;
  gap: var(--space-m);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 30rem) {
  .grid {
    grid-template-columns: repeat(auto-fit, minmax(9rem, 11rem));
    gap: 0.75rem;
  }
}
</style>
