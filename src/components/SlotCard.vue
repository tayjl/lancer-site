<script setup lang="ts">
// One loadout card (pilot loadout, mech mounts and systems): a header bar with the slot's name and its
// buttons ("tools" slot), then what's in it, or "// empty //" centred when "empty". Goes in a .slot-grid.
defineProps<{ title: string; empty?: boolean }>()
</script>

<template>
  <li class="slot">
    <header class="slot-head">
      <h3>{{ title }}</h3>
      <span class="tools"><slot name="tools" /></span>
    </header>
    <p v-if="empty" class="empty">// empty //</p>
    <div v-else class="slot-body"><slot /></div>
  </li>
</template>

<style scoped>
.slot {
  display: flex;
  flex-direction: column;
  min-height: 9rem;
  border: 1px solid var(--rule);
}

.slot-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0.6rem;
  border-left: 3px solid var(--lilac);
  background: var(--panel);
}

.slot-head h3 {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
}

.tools {
  display: flex;
  gap: 0.75rem;
  margin-left: auto;
}

.tools :slotted(button) {
  padding: 0;
  font-size: 0.75rem;
}

.slot-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem 0.75rem;
}

/* Centred in the space under the header. "max-width: none" undoes the 70ch cap on paragraphs (style.css),
   which left it off centre in wide slots. */
.empty {
  display: grid;
  flex: 1;
  place-items: center;
  max-width: none;
  margin: 0;
  color: var(--text-dim);
  font-size: 0.875rem;
}
</style>
