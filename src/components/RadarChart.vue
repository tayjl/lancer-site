<script setup lang="ts">
import { computed } from 'vue'

// A radar ("spider") chart, like COMP/CON's frame stats: one spoke per stat, the shape reaching out as far as the
// stat sits between the lowest and the highest any frame has ("at", 0 to 1). Labels name the stats; the numbers sit
// beside the chart (InfoDialog.vue), and in "summary" for screen readers.
const props = defineProps<{ axes: { label: string; value: string; at: number }[]; summary: string }>()

const SIZE = 520
const CENTRE = SIZE / 2
const RADIUS = 140
const RINGS = 5
// The lowest value still sits a little out from the centre, so it reads as a point rather than nothing.
const FLOOR = 0.12

const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / props.axes.length
const point = (i: number, r: number) => [CENTRE + Math.cos(angle(i)) * r, CENTRE + Math.sin(angle(i)) * r] as const
const polygon = (r: (i: number) => number) => props.axes.map((_, i) => point(i, r(i)).join(',')).join(' ')

const rings = computed(() => Array.from({ length: RINGS }, (_, k) => polygon(() => (RADIUS * (k + 1)) / RINGS)))
const shape = computed(() => props.axes.map((axis, i) => point(i, RADIUS * (FLOOR + (1 - FLOOR) * Math.min(1, Math.max(0, axis.at))))))
const labels = computed(() =>
  props.axes.map((axis, i) => {
    const [x, y] = point(i, RADIUS + 14)
    const cos = Math.cos(angle(i))
    return { ...axis, x, y, anchor: cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle' }
  }),
)
</script>

<template>
  <svg class="radar" :viewBox="`0 0 ${SIZE} ${SIZE}`" role="img" :aria-label="summary">
    <polygon v-for="(ring, k) in rings" :key="k" :points="ring" class="ring" />
    <line v-for="(_, i) in axes" :key="`spoke-${i}`" :x1="CENTRE" :y1="CENTRE" :x2="point(i, RADIUS)[0]" :y2="point(i, RADIUS)[1]" class="ring" />
    <polygon :points="shape.map((p) => p.join(',')).join(' ')" class="shape" />
    <circle v-for="(p, i) in shape" :key="`dot-${i}`" :cx="p[0]" :cy="p[1]" r="3.5" class="dot" />
    <text v-for="label in labels" :key="label.label" :x="label.x" :y="label.y" :text-anchor="label.anchor" dominant-baseline="middle" class="label">
      {{ label.label }}
    </text>
  </svg>
</template>

<style scoped>
.radar {
  display: block;
  width: 100%;
  max-width: 30rem;
  margin: 0 auto;
  overflow: visible;
}

.ring {
  fill: none;
  stroke: var(--rule);
  stroke-width: 1;
}

.shape {
  fill: var(--lilac);
  fill-opacity: 0.3;
  stroke: var(--lilac);
  stroke-width: 2;
  stroke-linejoin: round;
}

.dot {
  fill: var(--lilac);
}

.label {
  fill: var(--lilac);
  font: 400 13px var(--mono);
}
</style>
