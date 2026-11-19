<script setup lang="ts">
import Icon from './Icon.vue'

// An item's (or an action's) numbers in a row: each a symbol, the number in mono and a small word ("10 range",
// "4 kinetic", "+3 hp"). A damage symbol takes its damage type's colour (the --dmg-* tokens). "compact" (the pickers'
// rows) is smaller and drops the word when the symbol says it (it stays for screen readers and as a tooltip).
type Stat = { kind?: string; label: string; value: string; icon?: string | null }
defineProps<{ stats: Stat[]; compact?: boolean }>()
const DAMAGE = ['kinetic', 'energy', 'explosive', 'burn', 'heat', 'variable']
const colour = (stat: Stat) => (stat.kind === 'damage' && DAMAGE.includes(stat.label) ? { color: `var(--dmg-${stat.label})` } : undefined)
</script>

<template>
  <ul v-if="stats.length" class="item-stats" :class="{ compact }">
    <li v-for="(stat, i) in stats" :key="i" :title="compact && stat.icon ? `${stat.label} ${stat.value}` : undefined">
      <Icon v-if="stat.icon" :src="stat.icon" :style="colour(stat)" />
      <span class="num">{{ stat.value }}</span>
      <small :class="{ 'sr-only': compact && stat.icon }">{{ stat.label }}</small>
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

.compact {
  gap: 2px var(--space-s);
}

.compact .num {
  font-size: var(--fs-s);
}

.compact li .icon {
  width: 18px;
  height: 18px;
}

.compact small {
  font-size: var(--fs-xs);
}

small {
  color: var(--text-dim);
  font-size: var(--fs-s);
}
</style>
