<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'

// A radar ("spider") chart, like COMP/CON's frame stats: one spoke per stat, the shape reaching out as far as the
// stat sits between the lowest and the highest any frame has ("at", 0 to 1). Each label is the stat's name and number,
// with its symbol ("icon", optional) between it and the chart, in the label's colour; "summary" says it all for screen readers. "mini" is the pickers' tiny version: no labels or symbols, just the
// shape on its rings. "wrap" puts each word of a label on its own line, for big labels on a narrow chart.
const props = defineProps<{ axes: { label: string; value: string; icon?: string | null; at: number }[]; summary: string; mini?: boolean; labelSize?: number; wrap?: boolean }>()

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
// Wrapped (phone) labels get room at the sides inside the chart's own box, so they never run past it.
const viewBox = computed(() => {
  const edge = RADIUS + 12
  const pad = props.wrap ? 60 : 0
  return props.mini ? `${CENTRE - edge} ${CENTRE - edge} ${2 * edge} ${2 * edge}` : `${-pad} 0 ${SIZE + 2 * pad} ${SIZE}`
})
// The symbol (as tall as a line of the label) sits where the label used to start, just outside the rim, and the text moves
// out past it by its size and a small gap: beside it at the sides, above or below it at the top and bottom. Between the
// text and the chart, it never meets a neighbouring label however the labels wrap.
const labels = computed(() =>
  props.axes.map((axis, i) => {
    const [x, y] = point(i, RADIUS + 14)
    const cos = Math.cos(angle(i))
    const text = `${axis.label} ${axis.value}`
    // Wrapped, each word of the name on its own line, the number staying with the last.
    const lines = props.wrap ? `${axis.label} ${axis.value}`.split(' ') : []
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
    const font = props.labelSize ?? 14
    const size = 1.25 * font // the symbol: as tall as a line of the label
    const gap = font / 4
    const away = axis.icon ? size + gap : 0
    const out = Math.sin(angle(i)) < 0 ? -1 : 1 // top labels move up, bottom ones down
    const half = 0.55 * Math.max(1, lines.length) * font // half the text block's height
    const tx = anchor === 'start' ? x + away : anchor === 'end' ? x - away : x
    const ty = anchor === 'middle' && away ? y + out * (size / 2 + gap + half) : y
    const mark = { x: anchor === 'start' ? x : anchor === 'end' ? x - size : x - size / 2, y: y - size / 2, size }
    return { ...axis, text, tx, ty, lines, anchor, mark }
  }),
)
</script>

<template>
  <svg class="radar" :class="{ mini }" :viewBox="viewBox" role="img" :aria-label="summary">
    <polygon v-for="(ring, k) in rings" :key="k" :points="ring" class="ring" />
    <line v-for="(_, i) in axes" :key="`spoke-${i}`" :x1="CENTRE" :y1="CENTRE" :x2="point(i, RADIUS)[0]" :y2="point(i, RADIUS)[1]" class="ring" />
    <polygon :points="shape.map((p) => p.join(',')).join(' ')" class="shape" />
    <circle v-for="(p, i) in shape" :key="`dot-${i}`" :cx="p[0]" :cy="p[1]" r="3.5" class="dot" />
    <g v-for="label in mini ? [] : labels" :key="label.label">
      <foreignObject v-if="label.icon" :x="label.mark.x" :y="label.mark.y" :width="label.mark.size" :height="label.mark.size" class="label-icon">
        <Icon :src="label.icon" />
      </foreignObject>
      <text :x="label.tx" :y="label.ty" :text-anchor="label.anchor" dominant-baseline="middle" class="label" :style="labelSize ? { fontSize: `${labelSize}px` } : undefined">
        <template v-if="label.lines.length > 1">
          <tspan v-for="(line, l) in label.lines" :key="l" :x="label.tx" :dy="`${l ? 1.1 : -0.55 * (label.lines.length - 1)}em`">{{ line }}</tspan>
        </template>
        <template v-else>
          {{ label.text }}
        </template>
      </text>
    </g>
  </svg>
</template>

<style scoped>
/* Neutral: the rings in the divider grey, the shape in white with a faint fill, the labels in secondary text. */
.radar {
  display: block;
  width: 100%;
  max-width: 30rem;
  margin: 0 auto;
  overflow: visible;
}

.radar.mini {
  max-width: none;
  margin: 0;
}

.mini .ring {
  stroke-width: 5;
}

.mini .shape {
  stroke-width: 12;
}

.mini .dot {
  display: none;
}

.ring {
  fill: none;
  stroke: var(--rule);
  stroke-width: 1;
}

.shape {
  fill: var(--text);
  fill-opacity: 0.12;
  stroke: var(--text);
  stroke-width: 2;
  stroke-linejoin: round;
}

.dot {
  fill: var(--text);
}

/* The symbol fills its box, in the labels' colour. */
.label-icon {
  overflow: visible;
  color: var(--text-dim);
}

.label-icon .icon {
  display: block;
  width: 100%;
  height: 100%;
}

.label {
  fill: var(--text-dim);
  font: 700 14px var(--sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>
