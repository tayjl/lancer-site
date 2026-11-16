<script setup lang="ts">
import Icon from './Icon.vue'

// An item's (or an action's) numbers in a row: each a symbol, the number in mono and a small word ("10 range",
// "4 kinetic", "+3 hp"). A damage symbol takes its damage type's colour (the --dmg-* tokens).
type Stat = { kind?: string; label: string; value: string; icon?: string | null }
defineProps<{ stats: Stat[] }>()
const DAMAGE = ['kinetic', 'energy', 'explosive', 'burn', 'heat', 'variable']
const colour = (stat: Stat) => (stat.kind === 'damage' && DAMAGE.includes(stat.label) ? { color: `var(--dmg-${stat.label})` } : undefined)
</script>

<template>
  <ul v-if="stats.length" class="item-stats">
    <li v-for="(stat, i) in stats" :key="i">
      <Icon v-if="stat.icon" :src="stat.icon" :style="colour(stat)" />
      <span class="num">{{ stat.value }}</span>
      <small>{{ stat.label }}</small>
    </li>
  </ul>
</template>

<style scoped>
.item-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-l);
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

li .icon {
  width: 22px;
  height: 22px;
  color: var(--text-dim);
}

.num {
  font-weight: 700;
}

small {
  color: var(--text-dim);
  font-size: var(--fs-s);
}
</style>
