<script setup lang="ts">
// The head of a box in a grouped list (archives, content editor): an optional logo, the title, the count, and an optional button
// (the slot) at the right. The box's border and spacing are the list pane's, in style.css.
import Icon from './Icon.vue'

defineProps<{ title: string; count: number; logo?: string | null }>()
</script>

<template>
  <header class="group-head" :class="{ actionable: $slots.default }">
    <Icon v-if="logo" :src="logo" class="group-logo" />
    <h3>{{ title }}</h3>
    <span class="num dim count">{{ count }}</span>
    <slot />
  </header>
</template>

<style scoped>
/* A long title takes a line of its own for the button instead of breaking mid-word. */
.group-head {
  flex-wrap: wrap;
}

.group-head h3 {
  min-width: 0;
  margin: 0;
  font-size: var(--fs-s);
  letter-spacing: 0.08em;
  overflow-wrap: break-word;
  text-transform: uppercase;
}

/* The count sits at the right, or beside the title when a button takes the right. */
.count {
  margin-left: auto;
  font-size: var(--fs-xs);
  font-weight: 400;
  letter-spacing: 0;
}

.actionable .count {
  margin-left: 0;
}

.group-head :slotted(button) {
  flex: none;
  margin-left: auto;
}
</style>
