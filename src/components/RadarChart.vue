<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import Icon from './Icon.vue'

// A radar ("spider") chart, like COMP/CON's frame stats: one spoke per stat, the shape reaching out as far as the
// stat sits between the lowest and the highest any frame has ("at", 0 to 1). Each label is the stat's name and number,
// with its symbol ("icon", optional) between it and the chart, in the label's colour; "summary" says it all for screen readers. "mini" is the pickers' tiny version: no labels or symbols, just the
// shape on its rings. "wrap" puts each word of a label on its own line, for big labels on a narrow chart. "fit" widens
// the box to the drawn labels (measured), so none runs past it however narrow the chart (InfoBody.vue).
// "ink" draws it inside an ID card's picture (MechIdCard.vue), which has no stylesheet: colours and the font as attributes,
// each symbol a masked picture (masks "<prefix>-<n>"), and each label just its symbol and number.
const props = defineProps<{
  axes: { label: string; value: string; icon?: string | null; at: number }[]
  summary: string
  mini?: boolean
  labelSize?: number
  wrap?: boolean
  fit?: boolean
  ink?: { rule: string; text: string; dim: string; font: string; prefix: string }
}>()

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
  const pad = props.fit ? fitPad.value : props.wrap ? 60 : 0
  return props.mini ? `${CENTRE - edge} ${CENTRE - edge} ${2 * edge} ${2 * edge}` : `${-pad} 0 ${SIZE + 2 * pad} ${SIZE}`
})
// The symbol (as tall as a line of the label) sits where the label used to start, just outside the rim, and the text moves
// out past it by its size and a small gap: beside it at the sides, above or below it at the top and bottom. Between the
// text and the chart, it never meets a neighbouring label however the labels wrap.
const labels = computed(() =>
  props.axes.map((axis, i) => {
    const [x, y] = point(i, RADIUS + 14)
    const cos = Math.cos(angle(i))
    const text = props.ink ? axis.value : `${axis.label} ${axis.value}`
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
// "fit": how far the widest label reaches past either side of the chart, in the chart's own units (the same at any
// size, so it's measured once per set of labels, and again when the web font arrives). Equal on both sides, so the
// chart stays centred.
const svg = useTemplateRef<SVGSVGElement>('svg')
const fitPad = ref(0)
const measure = () => {
  if (!props.fit || !svg.value) return
  let reach = 0
  for (const text of svg.value.querySelectorAll('text')) {
    if (typeof text.getBBox !== 'function') return
    const box = text.getBBox()
    reach = Math.max(reach, -box.x, box.x + box.width - SIZE)
  }
  fitPad.value = Math.ceil(reach) + 4
}
watch(labels, () => nextTick(measure))
onMounted(() => { measure(); document.fonts?.ready.then(measure) })
// Each part's look: the stylesheet's classes, or with "ink" the same look as attributes.
const paint = computed(() => {
  const ink = props.ink
  if (!ink) return { ring: { class: 'ring' }, shape: { class: 'shape' }, dot: { class: 'dot' }, label: { class: 'label' } }
  return {
    ring: { fill: 'none', stroke: ink.rule, 'stroke-width': 1.5 },
    shape: { fill: ink.text, 'fill-opacity': 0.12, stroke: ink.text, 'stroke-width': 2.5, 'stroke-linejoin': 'round' as const },
    dot: { fill: ink.text },
    label: { fill: ink.text, 'font-family': `'${ink.font}'`, 'font-weight': 700 },
  }
})
</script>

<template>
  <svg ref="svg" :class="ink ? undefined : ['radar', { mini }]" :viewBox="viewBox" role="img" :aria-label="summary">
    <polygon v-for="(ring, k) in rings" :key="k" :points="ring" v-bind="paint.ring" />
    <line v-for="(_, i) in axes" :key="`spoke-${i}`" :x1="CENTRE" :y1="CENTRE" :x2="point(i, RADIUS)[0]" :y2="point(i, RADIUS)[1]" v-bind="paint.ring" />
    <polygon :points="shape.map((p) => p.join(',')).join(' ')" v-bind="paint.shape" />
    <circle v-for="(p, i) in shape" :key="`dot-${i}`" :cx="p[0]" :cy="p[1]" r="3.5" v-bind="paint.dot" />
    <g v-for="(label, i) in mini ? [] : labels" :key="label.label">
      <template v-if="label.icon && ink">
        <mask :id="`${ink.prefix}-${i}`" style="mask-type: alpha">
          <image :href="label.icon" data-what="stat symbols" :x="label.mark.x" :y="label.mark.y" :width="label.mark.size" :height="label.mark.size" />
        </mask>
        <rect :x="label.mark.x" :y="label.mark.y" :width="label.mark.size" :height="label.mark.size" :fill="ink.dim" :mask="`url(#${ink.prefix}-${i})`" />
      </template>
      <foreignObject v-else-if="label.icon" :x="label.mark.x" :y="label.mark.y" :width="label.mark.size" :height="label.mark.size" class="label-icon">
        <Icon :src="label.icon" />
      </foreignObject>
      <text :x="label.tx" :y="label.ty" :text-anchor="label.anchor" dominant-baseline="middle" v-bind="paint.label" :style="labelSize ? { fontSize: `${labelSize}px` } : undefined">
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
