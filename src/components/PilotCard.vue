<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import Portrait from './Portrait.vue'

// A pilot's showcase card (the registry, pending, memorial and the GM review queues): portrait, callsign, pilot name,
// mechs and player, centred. The slot adds a line (the queues' waiting time). The whole card is the link.
defineProps<{ to: RouteLocationRaw; image: string | null; callsign: string | null; name: string; mechs?: string; player?: string; dead?: boolean }>()
</script>

<template>
  <RouterLink :to="to" class="pilot-card" :class="{ dead }">
    <Portrait :src="image" :alt="`Portrait of ${callsign || name}`" />
    <span class="callsign">{{ callsign || name }}</span>
    <span>{{ name }}</span>
    <span v-if="mechs" class="dim">{{ mechs }}</span>
    <span v-if="player" class="dim">Player: {{ player }}</span>
    <slot />
    <span v-if="dead" class="badge dead">Dead</span>
  </RouterLink>
</template>

<style scoped>
.pilot-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  height: 100%;
  padding: var(--space-m);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
  color: var(--text);
  font-size: var(--fs-s);
  text-align: center;
  text-decoration: none;
  overflow-wrap: anywhere;
}

.pilot-card:hover,
.pilot-card:focus-visible {
  border-color: var(--lilac);
  color: var(--text);
}

.pilot-card :deep(.portrait) {
  align-self: stretch;
  margin-bottom: var(--space-s);
}

.callsign {
  font-size: 17px;
  font-weight: 700;
}

.badge {
  margin-top: var(--space-xs);
}

/* The memorial: the portrait fades, the callsign dims. */
.dead :deep(img) {
  opacity: 0.6;
}

.dead .callsign {
  color: var(--text-dim);
}
</style>
