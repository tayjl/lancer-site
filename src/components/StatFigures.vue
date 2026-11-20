<script setup lang="ts">
import Icon from './Icon.vue'

// The general stats (HP, armour, speed, e-defence, grit) as one row of figures: symbol, number in mono, name.
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
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  list-style: none;
}

.figure {
  display: grid;
  grid-template-columns: auto auto;
  justify-content: center;
  align-items: center;
  gap: 0 var(--space-m);
  padding: var(--space-m);
  border-left: 1px solid var(--rule);
}

.figure:first-child {
  border-left: 0;
}

.figure .icon {
  grid-row: span 2;
  width: 28px;
  height: 28px;
  color: var(--text-dim);
}

.value {
  font: 700 26px / 1.1 var(--mono);
}

.name {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Phones: three to a row, the symbol over the number. */
@media (max-width: 40rem) {
  .figures {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .figure {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: var(--space-s);
  }

  .figure:nth-child(3n + 1) {
    border-left: 0;
  }

  .figure:nth-child(n + 4) {
    border-top: 1px solid var(--rule);
  }

  .figure .icon {
    grid-row: auto;
    width: 24px;
    height: 24px;
  }

  .value {
    font-size: 22px;
  }
}
</style>
