<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { awardIcon } from '../commendations'
import { barcodeBars, cardFilename, fitText, pilotSerial } from '../idCard'
import { MONO_FAMILY, SANS_FAMILY, cardToPng, saveBlob } from '../idCardExport'
import { iconUrl } from '../icons'
import { imageUrl } from '../images'
import { formatDate } from '../time'

// An in-universe pilot licence: portrait, callsign, name, level, licence level, serial, status, the date approved and the
// pilot's medals, on a chip-card the size of a credit card (85.6 x 54, drawn at 856 x 540) with two corners cut off.
// Everything on it is public. It is an SVG so "Download card" can turn the very same drawing into a PNG
// (src/idCardExport.ts). The pilot's colour is the edge light, corner marks, rules and medals (decoration only). Colours
// are read from the site's tokens once, because a downloaded picture has no stylesheet to look them up in.
const props = defineProps<{
  id: number
  callsign: string | null
  name: string
  status: string
  approvedAt: string | null
  level: number
  licenceLevel: number
  portrait: string | null // the stored image path
  colour: string | null // the pilot's colour as drawn (displayColour), if they have one
  medals: string[] // the icon of each commendation
  draftOpen?: boolean // the page is showing an open change; the card still shows the approved pilot
}>()

const root = getComputedStyle(document.documentElement)
const token = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback
const ink = {
  panel: token('--panel', '#1c1c21'),
  raised: token('--raised', '#26252c'),
  rule: token('--rule', '#403f48'),
  text: token('--text', '#f5f4f7'),
  dim: token('--text-dim', '#b1afba'),
}
const accent = computed(() => props.colour ?? token('--edge', '#6e6c79'))
// Status gets a small lamp in its status colour (always with the word beside it).
const lamp = computed(() => {
  const status = props.status.toLowerCase()
  return status === 'approved' ? token('--ok', '#a9dfb5') : status === 'dead' ? token('--dead', '#b1afba') : token('--wait', '#f2d675')
})

// The card is 856 x 540 with the top-right and bottom-left corners cut off; the clip and the frame share the outline.
const CUT = 48
const outline = `M0 0H${856 - CUT}L856 ${CUT}V540H${CUT}L0 ${540 - CUT}Z`
const cuts = `M${856 - CUT} 0L856 ${CUT}M0 ${540 - CUT}L${CUT} 540`

// Text is cut to fit its space, measured with the same fonts the card is drawn in.
const context = document.createElement('canvas').getContext('2d')!
const fit = (text: string, weight: number, size: number, family: string, max: number) => {
  context.font = `${weight} ${size}px "${family}"`
  return fitText(text, max, (t) => context.measureText(t).width)
}

const title = computed(() => props.callsign || props.name)
// The right-hand block runs from x 290 to 820. The callsign is tracked 1px a letter, which measuring leaves out: 20px spare.
const callsignText = computed(() => fit(title.value.toUpperCase(), 600, 52, SANS_FAMILY, 510))
const nameText = computed(() => fit(props.name, 400, 28, SANS_FAMILY, 530))
const serial = computed(() => pilotSerial(props.id))
const BAR_UNIT = 4
const bars = computed(() => barcodeBars(serial.value, 96))
const portraitUrl = computed(() => imageUrl(props.portrait))
const approved = computed(() => (props.approvedAt ? formatDate(props.approvedAt).toUpperCase() : '–'))
// Two rows of label over value; the last value sits on the portrait's bottom edge (y 408).
const fields = computed(() => [
  { label: 'LEVEL', value: String(props.level), x: 290, ly: 292, vy: 338, size: 44, lamp: false },
  { label: 'LICENCE LEVEL', value: String(props.licenceLevel), x: 560, ly: 292, vy: 338, size: 44, lamp: false },
  { label: 'STATUS', value: props.status.toUpperCase(), x: 290, ly: 372, vy: 408, size: 30, lamp: true },
  { label: 'ISSUED', value: approved.value, x: 560, ly: 372, vy: 408, size: 30, lamp: false },
])
const MAX_MEDALS = 6
const medalIcons = computed(() => (props.medals.length > MAX_MEDALS ? props.medals.slice(0, MAX_MEDALS - 1) : props.medals).map((icon) => iconUrl(awardIcon(icon))))
const more = computed(() => Math.max(0, props.medals.length - (MAX_MEDALS - 1)))
// Medals centred on the barcode and serial beside them.
const MEDAL_Y = 478
const medalX = (i: number) => 796 - (medalIcons.value.length + (more.value ? 1 : 0) - 1 - i) * 54
const moreX = 796
// A hexagon of radius 25 around (x, MEDAL_Y), flat sides left and right.
const hex = (x: number) =>
  [[0, -25], [22, -12.5], [22, 12.5], [0, 25], [-22, 12.5], [-22, -12.5]].map(([dx, dy]) => `${x + dx},${MEDAL_Y + dy}`).join(' ')

const label = computed(() => `Pilot ID card for ${title.value}: level ${props.level}, licence level ${props.licenceLevel}, ${props.status}, serial ${serial.value}`)

// Download card
const svg = useTemplateRef<SVGSVGElement>('svg')
const busy = ref(false)
const note = ref<{ ok: boolean; text: string } | null>(null)
async function download() {
  if (!svg.value || busy.value) return
  busy.value = true
  note.value = null
  try {
    const { blob, dropped } = await cardToPng(svg.value)
    saveBlob(blob, cardFilename(title.value))
    note.value = { ok: true, text: dropped.length ? `Downloaded, without the ${dropped.join(' and ')} (it couldn't be fetched).` : 'Downloaded.' }
  } catch (error) {
    note.value = { ok: false, text: `Not downloaded: ${(error as Error).message || 'the card could not be drawn.'}` }
  }
  busy.value = false
}
</script>

<template>
  <section class="panel id-panel">
    <header class="sheet-head">
      <h2 class="sheet-label">Pilot ID</h2>
      <button type="button" class="small" :disabled="busy" @click="download">{{ busy ? 'Drawing…' : 'Download card' }}</button>
    </header>
    <p v-if="draftOpen" class="note lead">Shows your approved pilot.</p>
    <svg ref="svg" class="card" viewBox="0 0 856 540" role="img" :aria-label="label" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="id-card-shape"><path :d="outline" /></clipPath>
        <clipPath id="id-card-portrait"><rect x="36" y="120" width="216" height="288" /></clipPath>
        <!-- A faint grid under everything, and scan lines over the portrait. -->
        <pattern id="id-card-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" :stroke="ink.dim" stroke-width="1" /></pattern>
        <pattern id="id-card-scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.5" fill="#000" /></pattern>
        <!-- A static sheen in the pilot's colour, and a fade toward it up the portrait. -->
        <linearGradient id="id-card-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" :stop-color="accent" stop-opacity="0.16" />
          <stop offset="0.35" :stop-color="accent" stop-opacity="0" />
          <stop offset="0.7" :stop-color="accent" stop-opacity="0.07" />
          <stop offset="1" :stop-color="accent" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="id-card-tint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" :stop-color="accent" stop-opacity="0" />
          <stop offset="1" :stop-color="accent" stop-opacity="0.32" />
        </linearGradient>
        <filter id="id-card-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5" /></filter>
        <!-- Symbols are tinted by filling a block through a mask of the symbol's own shape. -->
        <mask id="id-card-logo" style="mask-type: alpha"><image :href="iconUrl('license')" data-what="licence symbol" x="36" y="26" width="48" height="48" /></mask>
        <mask id="id-card-pilot" style="mask-type: alpha"><image :href="iconUrl('pilot')" data-what="pilot symbol" x="104" y="228" width="72" height="72" /></mask>
        <mask v-for="(url, i) in medalIcons" :id="`id-card-medal-${i}`" :key="i" style="mask-type: alpha">
          <image :href="url" :data-what="`medal ${i + 1}`" :x="medalX(i) - 14" :y="MEDAL_Y - 14" width="28" height="28" />
        </mask>
      </defs>

      <g clip-path="url(#id-card-shape)">
        <rect width="856" height="540" :fill="ink.panel" />
        <rect width="856" height="540" fill="url(#id-card-grid)" opacity="0.18" />
        <rect width="856" height="540" fill="url(#id-card-sheen)" />

        <!-- Edge light: the cut corners in the pilot's colour with a soft glow, and marks at the two square corners. -->
        <g fill="none" :stroke="accent" stroke-width="4" stroke-linecap="square">
          <g filter="url(#id-card-glow)" opacity="0.7"><path :d="`${cuts}M0 0H150M0 0V90M856 540H706M856 540V450`" /></g>
          <path :d="cuts" />
          <path d="M14 56V14H56M842 484V526H800" stroke-width="3" />
        </g>

        <!-- Header: the licence symbol, the title, and a contact chip. -->
        <rect x="36" y="26" width="48" height="48" :fill="accent" mask="url(#id-card-logo)" />
        <text x="100" y="50" :fill="ink.text" :font-family="`'${SANS_FAMILY}'`" font-size="30" font-weight="700" letter-spacing="5">PILOT LICENCE</text>
        <text x="100" y="74" :fill="ink.dim" :font-family="`'${SANS_FAMILY}'`" font-size="19" font-weight="400" letter-spacing="2">UNION ADMINISTRATIVE DEPARTMENT</text>
        <g transform="translate(724 28)" fill="none" :stroke="ink.dim" stroke-width="2" opacity="0.8">
          <rect width="60" height="46" rx="8" />
          <path d="M0 16H18V30H0M60 16H42V30H60M30 0V16M30 30V46" />
          <rect x="18" y="16" width="24" height="14" :fill="accent" fill-opacity="0.2" :stroke="accent" />
        </g>
        <line x1="36" y1="100" x2="820" y2="100" :stroke="ink.rule" stroke-width="2" />
        <line x1="36" y1="100" x2="136" y2="100" :stroke="accent" stroke-width="4" />

        <!-- Portrait window: corner ticks, scan lines and a tint toward the pilot's colour. -->
        <rect x="36" y="120" width="216" height="288" :fill="ink.raised" />
        <rect v-if="!portraitUrl" x="104" y="228" width="72" height="72" :fill="ink.dim" mask="url(#id-card-pilot)" />
        <template v-else>
          <image :href="portraitUrl" data-what="portrait" x="36" y="120" width="216" height="288" preserveAspectRatio="xMidYMid slice" clip-path="url(#id-card-portrait)" />
          <rect x="36" y="120" width="216" height="288" fill="url(#id-card-tint)" />
          <rect x="36" y="120" width="216" height="288" fill="url(#id-card-scan)" opacity="0.22" />
        </template>
        <rect x="36" y="120" width="216" height="288" fill="none" :stroke="ink.rule" stroke-width="2" />
        <path d="M28 144V112H60M260 144V112H228M28 384V416H60M260 384V416H228" fill="none" :stroke="accent" stroke-width="4" />

        <!-- Name and figures. -->
        <text x="290" y="140" :fill="ink.dim" :font-family="`'${MONO_FAMILY}'`" font-size="22" font-weight="500" letter-spacing="3">CALLSIGN</text>
        <text x="290" y="194" :fill="ink.text" :font-family="`'${SANS_FAMILY}'`" font-size="52" font-weight="600" letter-spacing="1">{{ callsignText }}</text>
        <text x="290" y="232" :fill="ink.dim" :font-family="`'${SANS_FAMILY}'`" font-size="28" font-weight="400">{{ nameText }}</text>
        <line x1="290" y1="258" x2="820" y2="258" :stroke="ink.rule" stroke-width="2" />
        <g v-for="field in fields" :key="field.label">
          <text :x="field.x" :y="field.ly" :fill="ink.dim" :font-family="`'${MONO_FAMILY}'`" font-size="22" font-weight="500" letter-spacing="3">{{ field.label }}</text>
          <circle v-if="field.lamp" :cx="field.x + 8" :cy="field.vy - 11" r="7" :fill="lamp" />
          <text :x="field.x + (field.lamp ? 26 : 0)" :y="field.vy" :fill="ink.text" :font-family="`'${MONO_FAMILY}'`" :font-size="field.size" font-weight="700">{{ field.value }}</text>
        </g>

        <!-- Footer: barcode with the serial under it (clear of the cut corner), the medals on the right. -->
        <line x1="36" y1="436" x2="820" y2="436" :stroke="ink.rule" stroke-width="2" />
        <g :fill="ink.text" opacity="0.85">
          <rect v-for="bar in bars" :key="bar.x" :x="36 + bar.x * BAR_UNIT" y="450" :width="bar.w * BAR_UNIT" height="32" />
        </g>
        <text x="36" y="508" :fill="ink.dim" :font-family="`'${MONO_FAMILY}'`" font-size="22" font-weight="500" letter-spacing="3">{{ serial }}</text>
        <g v-for="(url, i) in medalIcons" :key="url + i">
          <polygon :points="hex(medalX(i))" :fill="ink.raised" :stroke="accent" stroke-width="3" />
          <rect :x="medalX(i) - 14" :y="MEDAL_Y - 14" width="28" height="28" :fill="accent" :mask="`url(#id-card-medal-${i})`" />
        </g>
        <g v-if="more">
          <polygon :points="hex(moreX)" :fill="ink.raised" :stroke="accent" stroke-width="3" />
          <text :x="moreX" :y="MEDAL_Y + 8" text-anchor="middle" :fill="accent" :font-family="`'${MONO_FAMILY}'`" font-size="22" font-weight="700">+{{ more }}</text>
        </g>
      </g>
      <path :d="outline" fill="none" :stroke="ink.rule" stroke-width="3" />
    </svg>
    <p v-if="note" class="note" :class="{ error: !note.ok }" :role="note.ok ? 'status' : 'alert'">{{ note.text }}</p>
  </section>
</template>

<style scoped>
header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
}

header button {
  margin-left: auto;
}

.card {
  display: block;
  width: 100%;
  max-width: 36rem;
  height: auto;
  margin: 0 auto;
}

.note {
  margin: var(--space-s) 0 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
  text-align: center;
}

.note.lead {
  margin: calc(-1 * var(--space-xs)) 0 var(--space-m);
  text-align: left;
}

.note.error {
  color: var(--danger);
}
</style>
