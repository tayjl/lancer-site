<script setup lang="ts">
// A row of terminal options that picks what shows below (my pilot's groups: stats, equipment, licences, talents;
// the archives' categories). The chosen one is "> stats <" in rose, like a terminal menu pointing at it. "label"
// names the row for screen readers.
withDefaults(defineProps<{ tabs: readonly string[]; label?: string }>(), { label: 'pilot sheet sections' })
const current = defineModel<string>({ required: true })
</script>

<template>
  <nav class="sheet-tabs" :aria-label="label">
    <button
      v-for="tab in tabs"
      :key="tab"
      type="button"
      :class="{ current: tab === current }"
      :aria-pressed="tab === current"
      @click="current = tab"
    >
      {{ tab }}
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
