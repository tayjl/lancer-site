<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import PilotCard from '../components/PilotCard.vue'
import { fetchPilots, type PublicPilot } from '../pilots'

// A grid of pilot cards with one status (route meta.status): the registry shows approved pilots, pending the
// new pilots waiting on a GM, the memorial dead pilots. Cards hold public info only, so every logged-in user
// sees them.
const route = useRoute()
const pilots = shallowRef<PublicPilot[]>([])
const loading = ref(true)
const error = ref('')

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

    <p v-if="loading" class="dim">loading records...</p>
    <p v-else-if="error" class="rose" role="alert">{{ error }}</p>
    <p v-else-if="!pilots.length" class="dim">{{ route.meta.empty }}</p>
    <ul v-else class="grid">
      <li v-for="pilot in pilots" :key="pilot.id"><PilotCard :pilot="pilot" /></li>
    </ul>
  </main>
</template>

<style scoped>
/* Small cards, as many to a row as fit, so the registry is easy to browse. */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 30rem) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: 0.75rem;
  }
}
</style>
