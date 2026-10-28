<script setup lang="ts">
import GlitchText from '../components/GlitchText.vue'
import PilotCard from '../components/PilotCard.vue'
import { examplePilots } from '../pilots'
</script>

<template>
  <main class="page">
    <h1><span class="prompt" aria-hidden="true">&gt; </span><GlitchText text="pilot_registry" /></h1>
    <ul class="grid">
      <li v-for="pilot in examplePilots" :key="pilot.id"><PilotCard :pilot="pilot" /></li>
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
