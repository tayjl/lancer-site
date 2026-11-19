<script setup lang="ts">
import { awardIcon } from '../commendations'
import Icon from './Icon.vue'

// A commendation as a small medal: its icon in a round badge (ringed in the pilot's colour when the page has one:
// decoration only) and its name beside it.
defineProps<{ icon: string; name: string }>()
</script>

<template>
  <span class="medal">
    <span class="disc" aria-hidden="true"><Icon :name="awardIcon(icon)" /></span>
    <span class="name">{{ name }}</span>
  </span>
</template>

<style scoped>
.medal {
  display: inline-flex;
  align-items: center;
  gap: var(--space-s);
  min-width: 0;
}

.disc {
  display: grid;
  flex: none;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 2px solid var(--pilot, var(--edge));
  border-radius: 50%;
  background: var(--raised);
  color: var(--text);
  font-size: 1.125rem;
}

.name {
  min-width: 0;
  color: var(--text);
  font-size: var(--fs-s);
  font-weight: 700;
  overflow-wrap: anywhere;
}
</style>
