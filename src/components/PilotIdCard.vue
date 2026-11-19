<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { awardIcon } from '../commendations'
import { cardFilename, fitText, pilotSerial } from '../idCard'
import { MONO_FAMILY, SANS_FAMILY, cardToPng, saveBlob } from '../idCardExport'
import { iconUrl } from '../icons'
import { imageUrl } from '../images'
import horusLogo from '../assets/logos/horus.svg'
import { formatDate } from '../time'

// An in-universe pilot licence: portrait, callsign, name, level, licence level, serial, status, the date approved and the
// pilot's medals, on a card the size of a credit card (85.6 x 54, drawn at 856 x 540). Everything on it is public.
// It is an SVG so "Download card" can turn the very same drawing into a PNG (src/idCardExport.ts). The pilot's colour is
// the accent band and rings (decoration only). Colours are read from the site's tokens once, because a downloaded
// picture has no stylesheet to look them up in.
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
  void: token('--void', '#111113'),
  raised: token('--raised', '#26252c'),
  rule: token('--rule', '#403f48'),
  text: token('--text', '#f5f4f7'),
  dim: token('--text-dim', '#b1afba'),
}
const accent = computed(() => props.colour ?? token('--edge', '#6e6c79'))

// Text is cut to fit its space, measured with the same fonts the card is drawn in.
const context = document.createElement('canvas').getContext('2d')!
const fit = (text: string, weight: number, size: number, family: string, max: number) => {
  context.font = `${weight} ${size}px "${family}"`
  return fitText(text, max, (t) => context.measureText(t).width)
}

const title = computed(() => props.callsign || props.name)
const callsignText = computed(() => fit(title.value.toUpperCase(), 700, 58, SANS_FAMILY, 532))
const nameText = computed(() => fit(props.name, 400, 28, SANS_FAMILY, 532))
const serial = computed(() => pilotSerial(props.id))
const portraitUrl = computed(() => imageUrl(props.portrait))
const approved = computed(() => (props.approvedAt ? formatDate(props.approvedAt).toUpperCase() : '–'))
const fields = computed(() => [
  { label: 'LEVEL', value: String(props.level), x: 288, y: 290 },
  { label: 'LICENCE LEVEL', value: String(props.licenceLevel), x: 548, y: 290 },
  { label: 'STATUS', value: props.status.toUpperCase(), x: 288, y: 372 },
  { label: 'APPROVED', value: approved.value, x: 548, y: 372 },
])
const MAX_MEDALS = 6
const medalIcons = computed(() => (props.medals.length > MAX_MEDALS ? props.medals.slice(0, MAX_MEDALS - 1) : props.medals).map((icon) => iconUrl(awardIcon(icon))))
const more = computed(() => Math.max(0, props.medals.length - (MAX_MEDALS - 1)))
const medalX = (i: number) => 798 - (medalIcons.value.length + (more.value ? 1 : 0) - 1 - i) * 56
const moreX = 798

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
        <clipPath id="id-card-shape"><rect width="856" height="540" rx="34" /></clipPath>
        <clipPath id="id-card-portrait"><rect x="36" y="124" width="216" height="288" rx="10" /></clipPath>
        <!-- Symbols are tinted by filling a block through a mask of the symbol's own shape. -->
        <mask id="id-card-logo" style="mask-type: alpha"><image :href="horusLogo" data-what="HORUS logo" x="30" y="16" width="64" height="64" /></mask>
        <mask id="id-card-pilot" style="mask-type: alpha"><image :href="iconUrl('pilot')" data-what="pilot symbol" x="104" y="216" width="72" height="72" /></mask>
        <mask v-for="(url, i) in medalIcons" :id="`id-card-medal-${i}`" :key="i" style="mask-type: alpha">
          <image :href="url" :data-what="`medal ${i + 1}`" :x="medalX(i) - 15" y="477" width="30" height="30" />
        </mask>
      </defs>

      <g clip-path="url(#id-card-shape)">
        <rect width="856" height="540" :fill="ink.panel" />
        <rect width="856" height="96" :fill="accent" />
        <rect x="30" y="16" width="64" height="64" :fill="ink.void" mask="url(#id-card-logo)" />
        <text x="112" y="50" :fill="ink.void" :font-family="`'${SANS_FAMILY}'`" font-size="30" font-weight="700" letter-spacing="4">PILOT LICENCE</text>
        <text x="112" y="78" :fill="ink.void" :font-family="`'${SANS_FAMILY}'`" font-size="20" font-weight="400" letter-spacing="1">HORUS · LANCER CAMPAIGN</text>
        <text x="824" y="62" text-anchor="end" :fill="ink.void" :font-family="`'${MONO_FAMILY}'`" font-size="26" font-weight="700">HOR_OS</text>

        <rect x="36" y="124" width="216" height="288" rx="10" :fill="ink.raised" />
        <rect v-if="!portraitUrl" x="104" y="216" width="72" height="72" :fill="ink.dim" mask="url(#id-card-pilot)" />
        <image v-else :href="portraitUrl" data-what="portrait" x="36" y="124" width="216" height="288" preserveAspectRatio="xMidYMid slice" clip-path="url(#id-card-portrait)" />
        <rect x="36" y="124" width="216" height="288" rx="10" fill="none" :stroke="accent" stroke-width="4" />

        <text x="288" y="184" :fill="ink.text" :font-family="`'${SANS_FAMILY}'`" font-size="58" font-weight="700">{{ callsignText }}</text>
        <text x="288" y="228" :fill="ink.dim" :font-family="`'${SANS_FAMILY}'`" font-size="28" font-weight="400">{{ nameText }}</text>
        <g v-for="field in fields" :key="field.label">
          <text :x="field.x" :y="field.y" :fill="ink.dim" :font-family="`'${SANS_FAMILY}'`" font-size="20" font-weight="700" letter-spacing="3">{{ field.label }}</text>
          <text :x="field.x" :y="field.y + 40" :fill="ink.text" :font-family="`'${MONO_FAMILY}'`" font-size="34" font-weight="700">{{ field.value }}</text>
        </g>

        <line x1="36" y1="448" x2="820" y2="448" :stroke="ink.rule" stroke-width="2" />
        <text x="36" y="480" :fill="ink.dim" :font-family="`'${SANS_FAMILY}'`" font-size="18" font-weight="700" letter-spacing="3">SERIAL</text>
        <text x="36" y="516" :fill="ink.text" :font-family="`'${MONO_FAMILY}'`" font-size="30" font-weight="700">{{ serial }}</text>
        <g v-for="(url, i) in medalIcons" :key="url + i">
          <circle :cx="medalX(i)" cy="492" r="24" :fill="ink.raised" :stroke="accent" stroke-width="3" />
          <rect :x="medalX(i) - 15" y="477" width="30" height="30" :fill="ink.text" :mask="`url(#id-card-medal-${i})`" />
        </g>
        <g v-if="more">
          <circle :cx="moreX" cy="492" r="24" :fill="ink.raised" :stroke="accent" stroke-width="3" />
          <text :x="moreX" y="502" text-anchor="middle" :fill="ink.text" :font-family="`'${MONO_FAMILY}'`" font-size="24" font-weight="700">+{{ more }}</text>
        </g>
      </g>
      <rect width="856" height="540" rx="34" fill="none" :stroke="ink.rule" stroke-width="3" />
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
