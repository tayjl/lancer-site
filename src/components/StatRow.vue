<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import StatSources from './StatSources.vue'

// A block of stats (personal and piloting stats on my pilot; mech stats): the section heading (with, for a "budget" of
// shared points, pips and "1 of 4 points left" at the right, red only when overspent), then a filled tile per stat: its
// symbol, its number, its name, and - / + pinned to the tile's foot when editable. On phones a budgeted block (personal
// stats, HASE) becomes one row per stat (symbol, name, number, - / +); the others stay tiles. "bonus" changes the
// displayed total. A null value (not worked out yet) shows as "–". "icon" is an SVG's url. Every stat's "contributors"
// are listed under the block. A parent can set --tile for the tiles' fill (one step lighter than what they sit on).
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
        <!-- One pip per point, filled while it's still to spend. Decoration: the words say it. -->
        <span v-if="budget && budget <= 12" class="pips" aria-hidden="true">
          <span v-for="n in budget" :key="n" class="pip" :class="{ on: n <= budget - used }"></span>
        </span>
        <template v-if="overspent"><span class="num">{{ used - budget }}</span> over the <span class="num">{{ budget }}</span> points</template>
        <template v-else><span class="num">{{ budget - used }}</span> of <span class="num">{{ budget }}</span> points left</template>
      </span>
    </header>
    <ul class="stats" :class="{ rows: budget !== undefined }">
      <li v-for="stat in stats" :key="stat.id" class="stat">
        <Icon v-if="stat.icon" :src="stat.icon" />
        <span class="value num">{{ shown(stat) }}</span>
        <span class="name">{{ stat.name }}</span>
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
    <StatSources :stats="stats" />
  </section>
</template>

<style scoped>
/* In a stretched row of sections (the stats tab), the tiles grow to fill the taller neighbour's height, so the tiles
   and their - / + line up across both sections. */
.stat-row {
  display: flex;
  flex-direction: column;
}

.pips {
  display: inline-flex;
  align-self: center;
  gap: 3px;
}

.pip {
  width: 8px;
  height: 8px;
  border: 1px solid var(--edge);
  border-radius: 50%;
}

/* The pilot's colour is decoration only. */
.pip.on {
  border-color: var(--pilot, var(--edge));
  background: var(--pilot, var(--edge));
}

.stats {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* No stats defined (e.g. personal stats before any exist): no empty grid. */
.stats:empty {
  display: none;
}

/* A filled tile with a strip of the page's identity colour (pilot or maker, decoration only) along its top. */
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-m) 6px;
  border-radius: var(--radius);
  background: var(--tile, var(--panel));
  box-shadow: inset 0 3px var(--page-accent, var(--pilot, var(--edge)));
  text-align: center;
}

.stat > .icon {
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

/* Pinned to the foot, so the buttons line up across tiles whose names wrap. */
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

@media (max-width: 40rem) {
  /* Four tiles to a row (three on the narrowest phones, so "Structure" still fits a tile). */
  .stats {
    grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
    gap: 6px;
  }

  .stat {
    padding-inline: 2px;
  }

  .value {
    font-size: 26px;
  }

  /* A two-word name ("System points") wraps onto a second line, centred, rather than running out of its tile; words
     never break. Never below the label size. */
  .name {
    letter-spacing: 0;
    line-height: 1.2;
    text-align: center;
  }

  /* Budgeted stats become filled rows (symbol, name, number, - / +), the colour strip down their left side. */
  .stats.rows {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-xs);
  }

  .rows .stat {
    flex-direction: row;
    gap: var(--space-m);
    padding: 4px var(--space-m);
    box-shadow: inset 3px 0 var(--page-accent, var(--pilot, var(--edge)));
    text-align: left;
  }

  .rows .name {
    flex: 1;
    color: var(--text);
    font-size: var(--fs-s);
    letter-spacing: 0.04em;
    text-align: left;
  }

  .rows .value {
    order: 1;
    min-width: 2ch;
    font-size: 24px;
    text-align: right;
  }

  .rows .steps {
    order: 2;
    margin: 0;
    padding: 0;
  }
}
</style>
