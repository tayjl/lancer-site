<script setup lang="ts">
import { computed } from 'vue'

// "Where these numbers come from" for one block of stats, shown under that block.
const props = defineProps<{ stats: { id: string; name: string; contributors?: string[] }[] }>()
const sourced = computed(() => props.stats.filter((stat) => stat.contributors?.length))
</script>

<template>
  <details v-if="sourced.length" class="how">
    <summary>Where these numbers come from</summary>
    <dl>
      <template v-for="stat in sourced" :key="stat.id">
        <dt>{{ stat.name }}</dt>
        <dd>{{ stat.contributors!.join(', ') }}</dd>
      </template>
    </dl>
  </details>
</template>

<style scoped>
.how {
  margin-top: var(--space-s);
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.how summary {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  color: var(--lilac);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

@media (pointer: coarse), (max-width: 40rem) {
  .how summary {
    min-height: 44px;
  }
}

.how dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px var(--space-l);
  margin: var(--space-s) 0 0;
}

.how dt {
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.how dd {
  margin: 0;
  color: var(--text);
}
</style>
