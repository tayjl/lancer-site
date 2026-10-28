<script setup lang="ts">
import { useRoute } from 'vue-router'
import { isGm } from '../auth'
import GlitchText from '../components/GlitchText.vue'

// Placeholder for pages that aren't built yet. It shows the page's name and purpose from the route.
const route = useRoute()
</script>

<template>
  <main class="page">
    <!-- The key restarts the title's glitch when moving between pages. -->
    <h1 :key="route.path"><span class="prompt" aria-hidden="true">&gt; </span><GlitchText :text="String(route.meta.title)" /></h1>
    <p>{{ route.meta.summary }}</p>
    <p v-if="route.meta.gm && !isGm" class="denied">access denied. gm clearance required.</p>
    <p v-else class="dim">module offline. it arrives in a later build.</p>
  </main>
</template>

<style scoped>
.denied {
  color: var(--rose);
}
</style>
