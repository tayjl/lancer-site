<script setup lang="ts">
import type { PublicPilot } from '../pilots'
import Portrait from './Portrait.vue'

// A small registry card: portrait, callsign, pilot name and mech. Clicking it opens the pilot's record.
defineProps<{ pilot: PublicPilot }>()
</script>

<template>
  <RouterLink :to="{ name: 'pilot-record', params: { id: pilot.id } }" class="card">
    <Portrait :src="pilot.pilot_image" :alt="`Portrait of ${pilot.callsign ?? pilot.pilot_name}`" />
    <p class="callsign">{{ pilot.callsign ?? pilot.pilot_name }}</p>
    <p>{{ pilot.pilot_name }}</p>
    <p v-if="pilot.mechs.length" class="dim">{{ pilot.mechs.map((mech) => mech.name).join(', ') }}</p>
  </RouterLink>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.75rem;
  border: 1px solid var(--rule);
  color: var(--text);
  font-size: 0.8125rem;
  text-decoration: none;
}

.card:hover {
  border-color: var(--lilac);
}

.card p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card .callsign {
  margin-top: 0.5rem;
  color: var(--lilac);
  font-size: 0.9375rem;
  font-weight: 600;
}
</style>
