<script setup lang="ts">
// A row of underline tabs that picks what shows below (a mech's sections, the archives' categories),
// in the global .tabs style. "label" names the row for screen readers; "counts" (optional) shows a number after a
// tab's name, e.g. "Frames 28". Left-aligned; when the row doesn't fit it scrolls sideways: with a fade over the right
// edge until the last tab is in view, the mouse wheel (up and down turn sideways), and a chevron button at each end
// while there's more that way.
import { onMounted, onUnmounted, onUpdated, ref, useTemplateRef } from 'vue'
import Icon from './Icon.vue'

withDefaults(defineProps<{ tabs: readonly string[]; label?: string; counts?: Record<string, number> }>(), { label: 'Pilot sheet sections' })
const current = defineModel<string>({ required: true })

const row = useTemplateRef<HTMLElement>('row')
const more = ref({ left: false, right: false })
const update = () => {
  const el = row.value
  if (!el) return
  const left = el.scrollLeft > 2
  const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
  // Only on a change: this runs after every render, and setting the refs re-renders.
  if (left !== more.value.left || right !== more.value.right) more.value = { left, right }
  el.toggleAttribute('data-end', !right)
}
// Again when the row changes width with the window, or its tabs change (counts, a search's extra "all" tab).
const resized = new ResizeObserver(update)
onMounted(() => row.value && resized.observe(row.value))
onUpdated(update)
onUnmounted(() => resized.disconnect())

// The wheel scrolls an overflowing row sideways. At either end (or with nothing to scroll) the page scrolls as usual.
function wheel(event: WheelEvent) {
  const el = row.value
  if (!el || event.deltaX || !event.deltaY || event.ctrlKey) return
  const room = el.scrollWidth - el.clientWidth
  if (room <= 0 || (event.deltaY < 0 && el.scrollLeft <= 0) || (event.deltaY > 0 && el.scrollLeft >= room - 1)) return
  event.preventDefault()
  el.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : 1)
}
const page = (direction: -1 | 1) => row.value?.scrollBy({ left: direction * row.value.clientWidth * 0.8, behavior: 'smooth' })
</script>

<template>
  <!-- The root takes the page's class (e.g. the sticky .sheet-tabs), so it carries no position of its own. -->
  <div class="tabs-wrap"><div class="tabs-row">
    <button v-if="more.left" type="button" class="small tabs-arrow left" aria-label="Scroll tabs left" tabindex="-1" @click="page(-1)"><Icon name="chevron-left" /></button>
    <nav ref="row" class="tabs" :aria-label="label" @scroll.passive="update" @wheel="wheel">
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
    <button v-if="more.right" type="button" class="small tabs-arrow right" aria-label="Scroll tabs right" tabindex="-1" @click="page(1)"><Icon name="chevron-right" /></button>
  </div></div>
</template>

<style scoped>
.tabs-row {
  position: relative;
}

/* Over the row's end, with the page's background so the tabs don't show through (the fade is under it). */
.tabs-arrow {
  position: absolute;
  top: 0;
  bottom: 1px; /* the row's rule */
  z-index: 1;
  min-height: 0;
  padding: 0 6px;
  border-radius: 0;
  background: var(--void);
}

.tabs-arrow:hover:not(:disabled) {
  background: color-mix(in srgb, var(--lilac) 8%, var(--void));
}

.left {
  left: 0;
}

.right {
  right: 0;
}

/* Touch swipes the row, and the arrow would hide a half-cut tab. */
@media (pointer: coarse) {
  .tabs-arrow {
    display: none;
  }
}
</style>
