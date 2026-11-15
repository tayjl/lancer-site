<script setup lang="ts">
import type { PublicPilot } from '../pilots'
import Portrait from './Portrait.vue'

// A small registry card: portrait, callsign, pilot name, mechs and player. Clicking it opens the pilot's record.
defineProps<{ pilot: PublicPilot }>()
</script>

<template>
  <RouterLink :to="{ name: 'pilot-record', params: { id: pilot.id } }" class="card" :class="{ dead: pilot.status === 'dead' }">
    <Portrait :src="pilot.pilot_image" :alt="`Portrait of ${pilot.callsign ?? pilot.pilot_name}`" />
    <p class="callsign">{{ pilot.callsign ?? pilot.pilot_name }}</p>
    <p>{{ pilot.pilot_name }}</p>
    <p v-if="pilot.mechs.length" class="dim">{{ pilot.mechs.map((mech) => mech.name).join(', ') }}</p>
    <p v-if="pilot.player" class="dim player">{{ pilot.player.display_name }}</p>
    <span v-if="pilot.status === 'dead'" class="badge dead">dead</span>
  </RouterLink>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  height: 100%;
  padding: 0.75rem;
  border: 1px solid var(--rule);
  background: var(--panel);
  color: var(--text);
  font-size: 0.875rem;
  text-align: center;
  text-decoration: none;
}

.card:hover,
.card:focus-visible {
  border-color: var(--lilac);
  background: var(--raised);
  color: var(--text);
}

.card p {
  max-width: none;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card .callsign {
  margin-top: 0.5rem;
  color: var(--lilac);
  font-size: 1.0625rem;
  font-weight: 700;
}

.player {
  font-size: 0.8125rem;
}

.card .badge {
  align-self: center;
  margin-top: 0.35rem;
}

/* The memorial: the portrait fades, the callsign dims. */
.dead :deep(img) {
  opacity: 0.6;
}

.dead .callsign {
  color: var(--text-dim);
}
</style>
