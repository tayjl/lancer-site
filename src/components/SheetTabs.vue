<script setup lang="ts">
// A row of underline tabs that picks what shows below (my pilot's and a mech's sections, the archives' categories),
// in the global .tabs style. "label" names the row for screen readers; "counts" (optional) shows a number after a
// tab's name, e.g. "Frames 28". Left-aligned; when the row doesn't fit it scrolls sideways, with a fade over the
// right edge until the last tab is in view.
import { onMounted, onUnmounted, onUpdated, useTemplateRef } from 'vue'

withDefaults(defineProps<{ tabs: readonly string[]; label?: string; counts?: Record<string, number> }>(), { label: 'Pilot sheet sections' })
const current = defineModel<string>({ required: true })

const row = useTemplateRef<HTMLElement>('row')
const markEnd = () => row.value?.toggleAttribute('data-end', row.value.scrollLeft + row.value.clientWidth >= row.value.scrollWidth - 2)
// Again when the row changes width with the window, or its tabs change (counts, a search's extra "all" tab).
const resized = new ResizeObserver(markEnd)
onMounted(() => row.value && resized.observe(row.value))
onUpdated(markEnd)
onUnmounted(() => resized.disconnect())
</script>

<template>
  <nav ref="row" class="tabs" :aria-label="label" @scroll.passive="markEnd">
    <button
      v-for="tab in tabs"
      :key="tab"
      type="button"
      class="tab"
      :aria-current="tab === current"
      @click="current = tab"
    >
      {{ tab }}<span v-if="counts?.[tab] !== undefined" class="count">{{ counts[tab] }}</span>
    </button>
  </nav>
</template>
