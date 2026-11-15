<script setup lang="ts">
// A row of terminal options that picks what shows below (my pilot's groups: stats, equipment, licences, talents;
// the archives' categories). The chosen one is "> stats <" in rose, like a terminal menu pointing at it. "label"
// names the row for screen readers.
// "counts" (optional) shows a number after a tab's name, e.g. "frames 28".
withDefaults(defineProps<{ tabs: readonly string[]; label?: string; counts?: Record<string, number> }>(), { label: 'pilot sheet sections' })
const current = defineModel<string>({ required: true })
</script>

<template>
  <nav class="sheet-tabs" :aria-label="label">
    <button
      v-for="tab in tabs"
      :key="tab"
      type="button"
      class="option"
      :class="{ current: tab === current }"
      :aria-pressed="tab === current"
      @click="current = tab"
    >
      {{ tab }}<span v-if="counts?.[tab] !== undefined" class="tab-count">{{ ' ' + counts[tab] }}</span>
    </button>
  </nav>
</template>

<style scoped>
.sheet-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem 1.5rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--rule);
}

.sheet-tabs button {
  padding: 0;
  font-size: 1.125rem;
}

.tab-count {
  color: var(--sky);
  font-size: 0.875rem;
  font-weight: 400;
}

/* The chosen group keeps the hover look: rose, with arrows for brackets. */
.current {
  color: var(--rose);
}

.current::before {
  content: '> ' / '';
}

.current::after {
  content: ' <' / '';
}
</style>
