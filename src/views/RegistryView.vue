<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import GlitchText from '../components/GlitchText.vue'
import PilotCard from '../components/PilotCard.vue'
import { fetchPilots, type PublicPilot } from '../pilots'

// A grid of pilot cards with one status: pilot_registry shows approved pilots, pending_paperwork shows
// pilots waiting on a GM (route meta.status). Cards hold public info only, so every logged-in user sees them.
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
    <h1 :key="route.path"><span class="prompt" aria-hidden="true">&gt; </span><GlitchText :text="String(route.meta.title)" /></h1>
    <p class="dim summary">{{ route.meta.summary }}</p>

    <p v-if="loading" class="dim">loading records...</p>
    <p v-else-if="error" class="rose" role="alert">{{ error }}</p>
    <p v-else-if="!pilots.length" class="dim">{{ route.meta.empty }}</p>
    <ul v-else class="grid">
      <li v-for="pilot in pilots" :key="pilot.id"><PilotCard :pilot="pilot" /></li>
    </ul>
  </main>
</template>

<style scoped>
.summary {
  margin: -0.5rem 0 1.5rem;
  font-size: 0.875rem;
}

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
