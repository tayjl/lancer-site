<script setup lang="ts">
import { computed } from 'vue'
import StatIcon from './StatIcon.vue'

// A card of stats (general, personal and piloting stats on my pilot; mech stats): the usual section label (with,
// for a "budget" of shared points, "[ available points left / total ]" in sky on the right, rose when overspent), then a bordered tile per
// stat, centred: its symbol and number in lilac, its name in white, and - / + to change it when editable. In a
// narrow space (phones) each stat gets its own line.
// "bonus" (e.g. from bionics) changes the displayed total, with the base and modifier under it. A null value
// (not worked out yet) shows as "-". "icon" is an SVG's url. "contributors" are listed under "sources".
const props = defineProps<{
  title: string
  tag?: string
  stats: { id: string; name: string; value: number | null; bonus?: number; icon?: string; contributors?: string[] }[]
  editable: boolean
  min: number
  max: number
  budget?: number
}>()
const emit = defineEmits<{ set: [id: string, value: number] }>()

const used = computed(() => props.stats.reduce((sum, stat) => sum + Math.max(0, (stat.value ?? props.min) - props.min), 0))
const spent = computed(() => props.budget !== undefined && used.value >= props.budget)
const overspent = computed(() => props.budget !== undefined && used.value > props.budget)
const shown = (stat: { value: number | null; bonus?: number }) => {
  if (stat.value === null) return '-'
  const total = stat.value + (stat.bonus ?? 0)
  return total === 0.5 ? '½' : String(total)
}
</script>

<template>
  <section class="stat-row">
    <header class="head sheet-head" :class="{ over: overspent }">
      <h2 class="sheet-label">{{ title }}<span v-if="tag" class="tag">{{ ' ' + tag }}</span></h2>
      <span v-if="budget !== undefined" class="budget">[ available points {{ budget - used }} / {{ budget }} ]</span>
    </header>
    <ul>
      <li v-for="stat in stats" :key="stat.id">
        <span class="value"><StatIcon v-if="stat.icon" :src="stat.icon" />{{ shown(stat) }}</span>
        <span class="name">{{ stat.name }}</span>
        <span v-if="stat.bonus" class="bonus">{{ stat.value }} base {{ stat.bonus > 0 ? '+' : '' }}{{ stat.bonus }}</span>
        <span v-if="editable" class="steps">
          <button
            type="button"
            :aria-label="`lower ${stat.name}`"
            :disabled="stat.value === null || stat.value <= min"
            @click="emit('set', stat.id, Math.min(max, stat.value! - 1))"
          >
            -
          </button>
          <button
            type="button"
            :aria-label="`raise ${stat.name}`"
            :disabled="stat.value === null || stat.value >= max || (spent && stat.value >= min)"
            @click="emit('set', stat.id, Math.max(min, stat.value! + 1))"
          >
            +
          </button>
        </span>
        <details v-if="stat.contributors?.length" class="sources">
          <summary>sources<span class="sr-only"> for {{ stat.name }}</span></summary>
          <p v-for="(source, index) in stat.contributors" :key="index">{{ source }}</p>
        </details>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.stat-row {
  container-type: inline-size;
}

/* The section label, with the points count at the end of its rule. Overspent points turn the count rose. */
.head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.budget {
  color: var(--sky);
  font-size: 0.8125rem;
  white-space: nowrap;
}

.over .budget {
  color: var(--rose);
}

ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  margin: 0;
  padding: 0;
  border: 1px solid var(--rule);
  list-style: none;
}

/* No stats defined (e.g. personal stats before any exist): no empty box. */
ul:empty {
  display: none;
}

li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.75rem 0.5rem;
  text-align: center;
}

li + li {
  border-left: 1px solid var(--rule);
}

.value {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--lilac);
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.1;
}

.name {
  color: var(--text);
  font-size: 0.8125rem;
  white-space: nowrap;
}

.bonus {
  color: var(--sky);
  font-size: 0.75rem;
}

.steps {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.2rem;
}

.sources {
  max-width: 100%;
  color: var(--text-dim);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.sources summary { cursor: pointer; }
.sources p { margin: 0.25rem 0; }

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

/* Too narrow for tiles side by side: one stat per line, name on the left, number and buttons on the right. */
@container (max-width: 40rem) {
  ul {
    grid-template-columns: minmax(0, 1fr);
  }

  li {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    padding: 0.4rem 0.75rem;
    text-align: left;
  }

  li + li {
    border-top: 1px solid var(--rule);
    border-left: 0;
  }

  .value {
    order: 1;
    min-width: 4rem;
    justify-content: flex-end;
    font-size: 1.375rem;
  }

  .name {
    flex: 1;
    font-size: 0.875rem;
  }

  .bonus {
    order: 1;
  }

  .steps {
    order: 2;
    margin-top: 0;
  }

  .sources {
    flex-basis: 100%;
    order: 3;
  }
}
</style>
