<script setup lang="ts">
// A symbol from src/assets/icons (LANCER's, COMP/CON's and Lucide's; see the README), drawn in the current text
// colour: the SVG is a mask over a block of colour. Give it a file's "name" (e.g. "lock", "hp") or an imported
// SVG's url as "src" (the manufacturer logos, the stat symbols in gameData.ts). The url is quoted, because Vite
// inlines small SVGs as data urls with spaces in them.
import { computed } from 'vue'

const ICONS = import.meta.glob<string>('../assets/icons/*.svg', { eager: true, query: '?url', import: 'default' })

const props = defineProps<{ name?: string; src?: string }>()
const url = computed(() => props.src ?? ICONS[`../assets/icons/${props.name}.svg`])
</script>

<template>
  <span class="icon" :style="url ? { maskImage: `url(${JSON.stringify(url)})` } : undefined" aria-hidden="true"></span>
</template>

<style scoped>
.icon {
  display: inline-block;
  flex: none;
  width: 1em;
  height: 1em;
  background: currentColor;
  mask: center / contain no-repeat;
}
</style>
