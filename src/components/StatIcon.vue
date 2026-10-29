<script setup lang="ts">
// A LANCER symbol (an SVG's url, from src/assets/icons), drawn in the current text colour: the SVG is a mask
// over a block of colour. Quoted, because Vite inlines small SVGs as data urls with spaces in them.
defineProps<{ src: string }>()
</script>

<template>
  <span class="stat-icon" :style="{ maskImage: `url(${JSON.stringify(src)})` }" aria-hidden="true"></span>
</template>

<style scoped>
.stat-icon {
  display: inline-block;
  flex: none;
  width: 1em;
  height: 1em;
  background: currentColor;
  mask: center / contain no-repeat;
}
</style>
