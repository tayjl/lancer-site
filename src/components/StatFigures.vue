<script setup lang="ts">
import Icon from './Icon.vue'

// The general stats (HP, armour, speed, e-defence, grit) as one row of filled tiles, like StatRow's: symbol, number, name.
defineProps<{ stats: { id: string; name: string; value: number | null; icon?: string }[] }>()
</script>

<template>
  <ul class="figures" aria-label="General stats">
    <li v-for="stat in stats" :key="stat.id" class="figure">
      <Icon v-if="stat.icon" :src="stat.icon" />
      <span class="value num">{{ stat.value ?? '–' }}</span>
      <span class="name">{{ stat.name }}</span>
    </li>
  </ul>
</template>

<style scoped>
.figures {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A filled tile with a strip of the pilot's colour (decoration only) along its top. */
.figure {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: var(--space-m) 6px;
  border-radius: var(--radius);
  background: var(--tile, var(--panel));
  box-shadow: inset 0 3px var(--pilot, var(--edge));
  text-align: center;
}

.figure .icon {
  width: 24px;
  height: 24px;
  color: var(--text-dim);
}

.value {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
}

.name {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Phones: three to a row, the last two sharing the second row. */
@media (max-width: 40rem) {
  .figures {
    gap: 6px;
  }

  .figure {
    flex-basis: 28%;
    padding-inline: 2px;
  }

  .value {
    font-size: 26px;
  }

  .name {
    letter-spacing: 0;
  }
}
</style>
