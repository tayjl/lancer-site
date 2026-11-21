<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { barcodeBars, cardFilename, cardFingerprint } from '../idCard'
import { MONO_FAMILY, SANS_FAMILY, cardInk, cardToken, fitCardText } from '../idCardExport'
import { iconUrl } from '../icons'
import { frameArtUrl, imageUrl, type FrameArt } from '../images'
import type { RadarAxis } from '../mechOverview'
import IdCardFrame from './IdCardFrame.vue'
import RadarChart from './RadarChart.vue'

// A mech's registration card, the pilot ID card's twin (same frame, download and silent save: IdCardFrame.vue): the
// maker's logo, the mech's name, frame and manufacturer id; its picture in a bracketed window (its upload, else the frame
// art, else the maker's logo dim); the radar of its stats with symbols and numbers (the mech page's, radarAxes()); then
// the pilot's callsign, size, system points and a barcode of the manufacturer id. Everything on it is public. The
// maker's colour is the edge light, corner marks and short rule (decoration only); without one the card is neutral.
const props = defineProps<{
  id: number // the pilot's
  mechId: string
  name: string
  manufacturerId: string
  frame: string | null // "IPS-N Blackbeard"
  logo: string | null // the maker's logo
  colour: string | null // the maker's colour, if it has one
  image: string | null // the mech's stored image path
  art: FrameArt | null // its frame's art
  callsign: string
  size: number | null
  spUsed: number
  spTotal: number | null
  axes: RadarAxis[]
  status: string
  draftOpen?: boolean // the page shows an open change: no picture is saved from it
  cardVersion?: string | null
  savePath?: string | null
}>()
const emit = defineEmits<{ cardSaved: [version: string] }>()

const ink = cardInk()
const accent = computed(() => props.colour ?? cardToken('--edge', '#6e6c79'))
const MONO = `'${MONO_FAMILY}'`
const SANS = `'${SANS_FAMILY}'`

// The name is tracked 1px a letter, which measuring leaves out: 30px spare before the cut corner.
const nameText = computed(() => fitCardText(props.name.toUpperCase(), 700, 40, SANS_FAMILY, 640))
const frameText = computed(() => fitCardText((props.frame ?? 'No frame').toUpperCase(), 400, 25, SANS_FAMILY, 380))
const callsignText = computed(() => fitCardText(props.callsign.toUpperCase(), 600, 34, SANS_FAMILY, 245))
const BAR_UNIT = 3
const bars = computed(() => barcodeBars(props.manufacturerId || props.mechId, 46))

// The picture: the upload (falling through if it fails to load), else the frame's art once its link is known.
const upload = computed(() => imageUrl(props.image))
const uploadFailed = ref(false)
watch(() => props.image, () => (uploadFailed.value = false))
const artUrl = ref<string | null>(null)
let run = 0
watch(
  () => props.art,
  async (art) => {
    const mine = ++run
    const next = art ? await frameArtUrl(art) : null
    if (mine === run) artUrl.value = next
  },
  { immediate: true },
)
const picture = computed(() => (upload.value && !uploadFailed.value ? { url: upload.value, fit: 'xMidYMid slice' } : artUrl.value ? { url: artUrl.value, fit: 'xMidYMid meet' } : null))
const logoUrl = computed(() => props.logo ?? iconUrl('frame'))

const sizeText = computed(() => (props.size === null ? '–' : props.size === 0.5 ? '½' : String(props.size)))
const spText = computed(() => (props.spTotal === null ? '–' : `${props.spUsed} / ${props.spTotal}`))
const radarInk = computed(() => ({ rule: ink.rule, text: ink.text, dim: ink.dim, font: SANS_FAMILY, prefix: 'mech-card-stat' }))
const summary = computed(() => props.axes.map((axis) => `${axis.label} ${axis.value}`).join(', '))
const label = computed(
  () =>
    `Registration card for ${props.name}: ${props.frame ?? 'no frame'}, manufacturer ID ${props.manufacturerId}, pilot ${props.callsign}` +
    (props.axes.length >= 3 ? `. ${summary.value}` : ''),
)

const fingerprint = computed(() =>
  cardFingerprint([props.id, props.mechId, props.name, props.manufacturerId, props.frame, props.colour, props.image, props.art, props.callsign, props.size, props.spUsed, props.spTotal, props.axes]),
)
const saveable = computed(() => !props.draftOpen && (props.status === 'approved' || props.status === 'dead'))
</script>

<template>
  <IdCardFrame
    prefix="mech-card"
    extra="mech-card-extra"
    :label="label"
    :accent="accent"
    :filename="cardFilename(name, 'card', 'mech')"
    :fingerprint="fingerprint"
    :saveable="saveable"
    :card-version="cardVersion"
    :save-path="savePath"
    :link="status === 'approved' || status === 'dead' ? { name: 'record-mech', params: { id, mechId } } : undefined"
    @card-saved="(version) => emit('cardSaved', version)"
  >
    <template #defs>
      <clipPath id="mech-card-window"><rect x="36" y="128" width="384" height="288" /></clipPath>
      <!-- Symbols are tinted by filling a block through a mask of the symbol's own shape. -->
      <mask id="mech-card-logo" style="mask-type: alpha"><image :href="logoUrl" data-what="maker logo" x="36" y="30" width="52" height="52" /></mask>
      <mask v-if="!picture" id="mech-card-placeholder" style="mask-type: alpha">
        <image :href="logoUrl" data-what="maker logo" x="168" y="212" width="120" height="120" />
      </mask>
    </template>

    <!-- Header: the maker's logo, the name, then the frame and manufacturer id. -->
    <rect x="36" y="30" width="52" height="52" :fill="accent" mask="url(#mech-card-logo)" />
    <text x="106" y="64" :fill="ink.text" :font-family="SANS" font-size="40" font-weight="700" letter-spacing="1">{{ nameText }}</text>
    <text x="106" y="99" :fill="ink.dim" :font-family="SANS" font-size="25" font-weight="400" letter-spacing="2">
      {{ frameText }} · <tspan :font-family="MONO" font-weight="500" letter-spacing="1">{{ manufacturerId }}</tspan>
    </text>
    <line x1="36" y1="112" x2="820" y2="112" :stroke="ink.rule" stroke-width="2" />
    <line x1="36" y1="112" x2="136" y2="112" :stroke="accent" stroke-width="4" />

    <!-- The picture window: corner brackets, scan lines and a tint toward the maker's colour. -->
    <rect x="36" y="128" width="384" height="288" :fill="ink.raised" />
    <rect v-if="!picture" x="168" y="212" width="120" height="120" :fill="ink.dim" opacity="0.5" mask="url(#mech-card-placeholder)" />
    <template v-else>
      <image
        :href="picture.url"
        data-what="mech image"
        x="36"
        y="128"
        width="384"
        height="288"
        :preserveAspectRatio="picture.fit"
        clip-path="url(#mech-card-window)"
        @error="uploadFailed = true"
      />
      <rect x="36" y="128" width="384" height="288" fill="url(#mech-card-tint)" />
      <rect x="36" y="128" width="384" height="288" fill="url(#mech-card-scan)" opacity="0.22" />
    </template>
    <rect x="36" y="128" width="384" height="288" fill="none" :stroke="ink.rule" stroke-width="2" />
    <path d="M28 152V120H60M428 152V120H396M28 392V424H60M428 392V424H396" fill="none" :stroke="accent" stroke-width="4" />

    <!-- The radar: symbols and numbers, at a size Discord's small preview can still read. Nothing without a frame (the header says so). -->
    <RadarChart v-if="axes.length >= 3" x="467" y="112" width="330" height="330" :axes="axes" :summary="summary" :label-size="42" overflow="visible" :ink="radarInk" />

    <!-- Footer: the pilot, size and system points, then a barcode of the manufacturer id (clear of the cut corner). -->
    <line x1="36" y1="444" x2="820" y2="444" :stroke="ink.rule" stroke-width="2" />
    <text x="36" y="478" :fill="ink.dim" :font-family="MONO" font-size="27" font-weight="500" letter-spacing="2">PILOT</text>
    <text x="36" y="514" :fill="ink.text" :font-family="SANS" font-size="34" font-weight="600" letter-spacing="1">{{ callsignText }}</text>
    <text x="305" y="478" :fill="ink.dim" :font-family="MONO" font-size="27" font-weight="500" letter-spacing="2">SIZE</text>
    <text x="305" y="514" :fill="ink.text" :font-family="MONO" font-size="34" font-weight="700">{{ sizeText }}</text>
    <text x="428" y="478" :fill="ink.dim" :font-family="MONO" font-size="27" font-weight="500" letter-spacing="2">SYSTEM POINTS</text>
    <text x="428" y="514" :fill="ink.text" :font-family="MONO" font-size="34" font-weight="700">{{ spText }}</text>
    <g :fill="ink.text" opacity="0.85">
      <rect v-for="bar in bars" :key="bar.x" :x="682 + bar.x * BAR_UNIT" y="466" :width="bar.w * BAR_UNIT" height="48" />
    </g>
  </IdCardFrame>
</template>
