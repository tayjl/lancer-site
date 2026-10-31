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
/* Looks like the name it replaces, with a dotted underline to show it opens more. No terminal brackets. */
.info-link {
  display: inline;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: inherit;
  text-decoration: underline dotted color-mix(in srgb, currentColor 45%, transparent);
  text-underline-offset: 0.2em;
}

.info-link::before,
.info-link::after {
  content: none;
}

.info-link:hover,
.info-link:focus-visible {
  color: var(--rose);
  text-decoration: underline solid;
}
</style>
