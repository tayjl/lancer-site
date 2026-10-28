<script setup lang="ts">
// A horizontal row of stats: each one's name and number, with - and + to change it when editable.
// "bonus" (e.g. from bionics) is shown next to the number, but isn't part of what you set.
defineProps<{
  title: string
  stats: { id: string; name: string; value: number; bonus?: number }[]
  editable: boolean
  min: number
  max: number
}>()
const emit = defineEmits<{ set: [id: string, value: number] }>()
</script>

<template>
  <section class="stat-row">
    <h2 class="sheet-label">{{ title }}</h2>
    <ul>
      <li v-for="stat in stats" :key="stat.id">
        <span class="name">{{ stat.name }}</span>
        <span class="value">
          {{ stat.value }}<span v-if="stat.bonus" class="bonus"> +{{ stat.bonus }}</span>
        </span>
        <span v-if="editable" class="steps">
          <button
            type="button"
            :aria-label="`lower ${stat.name}`"
            :disabled="stat.value <= min"
            @click="emit('set', stat.id, stat.value - 1)"
          >
            -
          </button>
          <button
            type="button"
            :aria-label="`raise ${stat.name}`"
            :disabled="stat.value >= max"
            @click="emit('set', stat.id, stat.value + 1)"
          >
            +
          </button>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
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
  color: var(--text-dim);
  font-size: 0.8125rem;
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

/* Phones: wrap into a grid, and drop the dividers between cells. */
@media (max-width: 30rem) {
  ul {
    grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
  }

  li + li {
    border-left: 0;
  }
}
</style>
