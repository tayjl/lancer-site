<script setup lang="ts">
import { computed } from 'vue'
import StatIcon from './StatIcon.vue'

// A row of stats: each one's name and number, with - and + to change it when editable. One line when there's
// room; in a narrow space (phones) each stat gets its own line instead, so they stay lined up.
// "bonus" (e.g. from bionics) is shown next to the number, but isn't part of what you set. A null value
// (not worked out yet) shows as "-". "icon" is an SVG's url, drawn in the text colour.
// With "budget", the values share a pool of points (e.g. HASE: 2 + licence level): the header shows
// used/total, and + stops once it's spent.
const props = defineProps<{
  title: string
  tag?: string
  stats: { id: string; name: string; value: number | null; bonus?: number; icon?: string }[]
  editable: boolean
  min: number
  max: number
  budget?: { label: string; total: number }
}>()
const emit = defineEmits<{ set: [id: string, value: number] }>()

const used = computed(() => props.stats.reduce((sum, stat) => sum + (stat.value ?? 0), 0))
const spent = computed(() => !!props.budget && used.value >= props.budget.total)
</script>

<template>
  <section class="stat-row">
    <header class="head">
      <h2 class="sheet-label">{{ title }}<span v-if="tag" class="tag"> [{{ tag }}]</span></h2>
      <span v-if="budget" class="budget" :class="{ rose: used > budget.total }">{{ budget.label }} {{ used }}/{{ budget.total }}</span>
    </header>
    <ul>
      <li v-for="stat in stats" :key="stat.id">
        <span class="name">
          <StatIcon v-if="stat.icon" :src="stat.icon" class="icon" />
          {{ stat.name }}
        </span>
        <span class="value">
          {{ stat.value ?? '-' }}<span v-if="stat.bonus" class="bonus"> +{{ stat.bonus }}</span>
        </span>
        <span v-if="editable" class="steps">
          <button
            type="button"
            :aria-label="`lower ${stat.name}`"
            :disabled="stat.value === null || stat.value <= min"
            @click="emit('set', stat.id, stat.value! - 1)"
          >
            -
          </button>
          <button
            type="button"
            :aria-label="`raise ${stat.name}`"
            :disabled="stat.value === null || stat.value >= max || spent"
            @click="emit('set', stat.id, stat.value! + 1)"
          >
            +
          </button>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.stat-row {
  container-type: inline-size;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 1rem;
}

.budget {
  color: var(--text-dim);
  font-size: 0.8125rem;
}

ul {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  margin: 0;
  padding: 0;
  border: 1px solid var(--rule);
  list-style: none;
}

li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.6rem 0.5rem;
}

li + li {
  border-left: 1px solid var(--rule);
}

.name {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-dim);
  font-size: 0.8125rem;
  white-space: nowrap;
}

.icon {
  color: var(--lilac);
  font-size: 1.125rem;
}

.value {
  color: var(--lilac);
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
}

.bonus {
  color: var(--sky);
  font-size: 0.875rem;
  font-weight: 400;
}

.steps {
  display: flex;
  gap: 0.35rem;
}

/* Small square steppers instead of the usual [ bracketed ] buttons. */
.steps button {
  width: 1.75rem;
  padding: 0;
  border: 1px solid var(--rule);
  color: var(--text-dim);
  font-weight: 400;
  line-height: 1.4;
}

.steps button::before,
.steps button::after {
  content: none;
}

.steps button:hover:not(:disabled),
.steps button:focus-visible {
  border-color: var(--lilac);
  color: var(--lilac);
}

.steps button:focus-visible {
  outline: 1px solid var(--lilac);
  outline-offset: 2px;
}

.steps button:disabled {
  opacity: 0.35;
  cursor: default;
}

/* Too narrow for one line: a list, one stat per line, with the numbers and buttons lined up on the right. */
@container (max-width: 40rem) {
  ul {
    grid-auto-flow: row;
  }

  li {
    flex-direction: row;
    gap: 1rem;
    padding: 0.4rem 0.75rem;
  }

  li + li {
    border-top: 1px solid var(--rule);
    border-left: 0;
  }

  .name {
    flex: 1;
    font-size: 0.875rem;
  }

  .value {
    min-width: 4rem;
    font-size: 1.375rem;
    text-align: right;
  }
}
</style>
