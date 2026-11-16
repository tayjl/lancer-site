<script setup lang="ts">
// One place in a loadout (a pilot slot, a mech mount, a system): its name, if it has one, as a small uppercase label
// above; then its card (ItemDetails), or, with "empty", the dashed empty state with that sentence and the "action"
// slot's button ("Empty. Takes one Main or two Auxiliary weapons." [Equip weapon]). Goes in a .slot-grid.
defineProps<{ label?: string; empty?: string }>()
</script>

<template>
  <li class="slot">
    <p v-if="label" class="label">{{ label }}</p>
    <div v-if="empty" class="empty">
      <p>{{ empty }}</p>
      <slot name="action" />
    </div>
    <slot v-else />
  </li>
</template>

<style scoped>
.slot {
  display: grid;
  align-content: start;
  gap: var(--space-xs);
}

.label,
.empty p {
  margin: 0;
}
</style>
