<script setup lang="ts">
import { showInfo, type Info } from '../info'

// An item's name that opens its full information (InfoDialog.vue). "info" is only worked out when clicked.
const props = defineProps<{ info: () => Info; label: string }>()
</script>

<template>
  <button type="button" class="info-link" :aria-label="`full information: ${label}`" @click="showInfo(props.info())">
    <slot>{{ label }}</slot>
  </button>
</template>

<style scoped>
/* Looks like the name it replaces (not like a button), in its own colour: a real button with a pointer that underlines
   on hover and focus (the prototype's item names). */
.info-link {
  display: inline;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-align: inherit;
  text-transform: inherit;
  white-space: inherit;
  cursor: pointer;
  text-decoration: underline 2px transparent;
  text-underline-offset: 0.2em;
}

.info-link::before,
.info-link::after {
  content: none;
}

.info-link:hover,
.info-link:focus-visible {
  background: none;
  text-decoration-color: currentColor;
}

.info-link:focus-visible {
  border-radius: 2px;
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
</style>
