<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'

// A block of stats (general, personal and piloting stats on my pilot; mech stats): the section heading (with, for a
// "budget" of shared points, "1 of 4 points left" at the right, red only when overspent), then a tile per stat: its
// symbol, its number, its name, any modifier under it, and - / + pinned to the tile's foot when editable. On phones a
// budgeted block (personal stats, HASE) becomes one line per stat (symbol, name, number, - / +); the others stay tiles,
// four to a row. "bonus" (e.g. from bionics) changes the displayed total, with the base and modifier under it. A null
// value (not worked out yet) shows as "–". "icon" is an SVG's url. Every stat's "contributors" are listed together
// under "Where these numbers come from".
const props = defineProps<{
  title: string
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
const sources = computed(() => props.stats.filter((stat) => stat.contributors?.length))
const shown = (stat: { value: number | null; bonus?: number }) => {
  if (stat.value === null) return '–'
  const total = stat.value + (stat.bonus ?? 0)
  return total === 0.5 ? '½' : String(total)
}
// Why a step button is off, for its tooltip.
const lowerBlocked = (value: number | null) => (value !== null && value <= props.min ? `At the minimum (${props.min})` : undefined)
const raiseBlocked = (value: number | null) =>
  value === null ? undefined : value >= props.max ? `At the maximum (${props.max})` : spent.value && value >= props.min ? 'No points left' : undefined
</script>

<template>
  <section class="stat-row">
    <header class="sheet-head head">
      <h2 class="sheet-label">{{ title }}</h2>
      <span v-if="budget !== undefined" class="meter-inline" :class="{ over: overspent }">
        <template v-if="overspent"><span class="num">{{ used - budget }}</span> over the <span class="num">{{ budget }}</span> points</template>
        <template v-else><span class="num">{{ budget - used }}</span> of <span class="num">{{ budget }}</span> points left</template>
      </span>
    </header>
    <ul class="stats" :class="{ rows: budget !== undefined }">
      <li v-for="stat in stats" :key="stat.id" class="stat">
        <Icon v-if="stat.icon" :src="stat.icon" />
        <span class="value num">{{ shown(stat) }}</span>
        <span class="text">
          <span class="name">{{ stat.name }}</span>
          <span v-if="stat.bonus" class="note"><span class="num">{{ stat.value }}</span> base {{ stat.bonus > 0 ? '+' : '−' }} <span class="num">{{ Math.abs(stat.bonus) }}</span></span>
        </span>
        <span v-if="editable" class="steps">
          <button
            type="button"
            :aria-label="`Lower ${stat.name}`"
            :title="lowerBlocked(stat.value)"
            :disabled="stat.value === null || stat.value <= min"
            @click="emit('set', stat.id, Math.min(max, stat.value! - 1))"
          >
            <Icon name="minus" />
          </button>
          <button
            type="button"
            :aria-label="`Raise ${stat.name}`"
            :title="raiseBlocked(stat.value)"
            :disabled="stat.value === null || stat.value >= max || (spent && stat.value >= min)"
            @click="emit('set', stat.id, Math.max(min, stat.value! + 1))"
          >
            <Icon name="plus" />
          </button>
        </span>
      </li>
    </ul>
    <details v-if="sources.length" class="sources">
      <summary>Where these numbers come from</summary>
      <dl>
        <template v-for="stat in sources" :key="stat.id">
          <dt>{{ stat.name }}</dt>
          <dd>{{ stat.contributors!.join(', ') }}</dd>
        </template>
      </dl>
    </details>
  </section>
</template>

<style scoped>
/* In a stretched row of sections (the stats tab), the tiles grow to fill the taller neighbour's height, so the tiles
   and their - / + line up across both sections. */
.stat-row {
  display: flex;
  flex-direction: column;
}

.stats {
  flex: 1;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.stats.rows {
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
}

/* No stats defined (e.g. personal stats before any exist): no empty grid. */
.stats:empty {
  display: none;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-s) 6px var(--space-m);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--void);
  text-align: center;
}

.stat > .icon {
  width: 24px;
  height: 24px;
  color: var(--text-dim);
}

.value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.15;
}

.text {
  display: grid;
  justify-items: center;
}

.name {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.note {
  color: var(--info);
  font-size: var(--fs-xs);
}

/* Pinned to the foot, so a modifier note never pushes one tile's buttons below its neighbours'. */
.steps {
  display: flex;
  gap: 6px;
  margin-top: auto;
  padding-top: 6px;
}

.steps button {
  width: var(--tap);
  padding: 0;
}

.steps .icon {
  width: 16px;
  height: 16px;
}

.sources {
  margin-top: var(--space-m);
  font-size: var(--fs-s);
}

.sources summary {
  color: var(--lilac);
  cursor: pointer;
}

.sources dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px var(--space-l);
  margin: var(--space-s) 0 0;
}

.sources dt {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sources dd {
  margin: 0;
}

@media (max-width: 40rem) {
  /* Four tiles to a row (three on the narrowest phones, so "Structure" still fits a tile). */
  .stats {
    grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
    gap: 6px;
  }

  .stat {
    padding-inline: 2px;
  }

  /* A two-word name ("System points") wraps onto a second line, centred, rather than running out of its tile; words
     never break. Never below the label size. */
  .name {
    letter-spacing: 0;
    line-height: 1.2;
    text-align: center;
  }

  /* Budgeted stats become rows: symbol, name (modifier under it), number, - / +. */
  .stats.rows {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }

  .rows .stat {
    flex-direction: row;
    gap: var(--space-m);
    padding: 4px var(--space-m);
    border: 0;
    border-bottom: 1px solid var(--rule);
    border-radius: 0;
    text-align: left;
  }

  .rows .stat:last-child {
    border-bottom: 0;
  }

  .rows .text {
    flex: 1;
    justify-items: start;
  }

  .rows .name {
    color: var(--text);
    font-size: var(--fs-s);
    letter-spacing: 0.04em;
  }

  .rows .value {
    order: 1;
    min-width: 2ch;
    font-size: 20px;
    text-align: right;
  }

  .rows .steps {
    order: 2;
    margin: 0;
    padding: 0;
  }
}
</style>
