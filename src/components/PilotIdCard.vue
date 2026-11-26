<script setup lang="ts">
import { computed } from 'vue'
import { awardIcon } from '../commendations'
import { barcodeBars, cardFilename, cardFingerprint, pilotSerial } from '../idCard'
import { MONO_FAMILY, SANS_FAMILY, cardInk, cardToken, fitCardText } from '../idCardExport'
import { iconUrl } from '../icons'
import { imageUrl } from '../images'
import { formatDate } from '../time'
import IdCardFrame from './IdCardFrame.vue'

// An in-universe pilot licence: portrait, callsign, name, level, licence level, serial, status, the date approved and the
// pilot's medals, on a chip-card the size of a credit card (85.6 x 54, drawn at 856 x 540) with two corners cut off.
// Everything on it is public. The card's frame, its download and its silent save are IdCardFrame.vue's. The pilot's
// colour is the edge light, corner marks, rules and medals (decoration only). Colours are read from the site's tokens
// once, because a downloaded picture has no stylesheet to look them up in.
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
  draft?: boolean // pending but not submitted yet: shown as Draft
  draftOpen?: boolean // the page is showing an open change; the card still shows the approved pilot
  cardVersion?: string | null // the fingerprint of the picture saved to storage
  savePath?: string | null // where to save the picture; null when this viewer may not
  extra?: string // the section head's spot for Download card; none in the pilot lists
}>()
const emit = defineEmits<{ cardSaved: [version: string] }>()

const ink = cardInk()
// Every SVG id starts with this, so the many cards on a pilot list don't share clips, masks and gradients.
const pre = computed(() => `id-card-${props.id}`)
const accent = computed(() => props.colour ?? cardToken('--edge', '#6e6c79'))
// Status gets a small lamp in its status colour (always with the word beside it).
const lamp = computed(() => {
  const status = props.status.toLowerCase()
  return status === 'approved' ? cardToken('--ok', '#a9dfb5') : status === 'dead' ? cardToken('--dead', '#b1afba') : cardToken('--wait', '#f2d675')
})

const statusWord = computed(() => (props.draft ? 'Draft' : props.status))
const title = computed(() => props.callsign || props.name)
// The right-hand block runs from x 290 to 820. The callsign is tracked 1px a letter, which measuring leaves out: 20px spare.
const callsignText = computed(() => fitCardText(title.value.toUpperCase(), 600, 52, SANS_FAMILY, 510))
const nameText = computed(() => fitCardText(props.name, 400, 28, SANS_FAMILY, 530))
const serial = computed(() => pilotSerial(props.id))
const BAR_UNIT = 4
const bars = computed(() => barcodeBars(serial.value, 96))
const portraitUrl = computed(() => imageUrl(props.portrait))
const approved = computed(() => (props.approvedAt ? formatDate(props.approvedAt).toUpperCase() : '–'))
// Two rows of label over value; the last value sits on the portrait's bottom edge (y 408).
const fields = computed(() => [
  { label: 'LEVEL', value: String(props.level), x: 290, ly: 292, vy: 338, size: 44, lamp: false },
  { label: 'LICENCE LEVEL', value: String(props.licenceLevel), x: 560, ly: 292, vy: 338, size: 44, lamp: false },
  { label: 'STATUS', value: statusWord.value.toUpperCase(), x: 290, ly: 372, vy: 408, size: 30, lamp: true },
  { label: 'ISSUED', value: approved.value, x: 560, ly: 372, vy: 408, size: 30, lamp: false },
])
const MAX_MEDALS = 6
const medalIcons = computed(() => (props.medals.length > MAX_MEDALS ? props.medals.slice(0, MAX_MEDALS - 1) : props.medals).map((icon) => iconUrl(awardIcon(icon))))
const more = computed(() => Math.max(0, props.medals.length - (MAX_MEDALS - 1)))
// Medals centred on the footer, right of the barcode.
const MEDAL_Y = 478
const medalX = (i: number) => 796 - (medalIcons.value.length + (more.value ? 1 : 0) - 1 - i) * 54
const moreX = 796
// A hexagon of radius 25 around (x, MEDAL_Y), flat sides left and right.
const hex = (x: number) =>
  [[0, -25], [22, -12.5], [22, 12.5], [0, 25], [-22, 12.5], [-22, -12.5]].map(([dx, dy]) => `${x + dx},${MEDAL_Y + dy}`).join(' ')

const label = computed(() => `Pilot ID card for ${title.value}: level ${props.level}, licence level ${props.licenceLevel}, ${statusWord.value.toLowerCase()}, serial ${serial.value}`)

// Only approved or dead pilots have a preview.
const fingerprint = computed(() =>
  cardFingerprint([props.id, props.callsign, props.name, props.status, props.approvedAt, props.level, props.licenceLevel, props.portrait, props.colour, props.medals]),
)
const saveable = computed(() => !props.draftOpen && (props.status === 'approved' || props.status === 'dead'))
</script>

<template>
  <IdCardFrame
    :prefix="pre"
    :extra="extra"
    :label="label"
    :accent="accent"
    :filename="cardFilename(title)"
    :note="draftOpen ? 'Shows your approved pilot.' : undefined"
    :fingerprint="fingerprint"
    :saveable="saveable"
    :card-version="cardVersion"
    :save-path="savePath"
    :link="status === 'approved' || status === 'dead' ? { name: 'pilot-record', params: { id } } : undefined"
    @card-saved="(version) => emit('cardSaved', version)"
  >
    <template #defs>
      <clipPath :id="`${pre}-portrait`"><rect x="36" y="120" width="216" height="288" /></clipPath>
      <!-- Symbols are tinted by filling a block through a mask of the symbol's own shape. -->
      <mask :id="`${pre}-logo`" style="mask-type: alpha"><image :href="iconUrl('license')" data-what="licence symbol" x="36" y="26" width="48" height="48" /></mask>
      <mask :id="`${pre}-pilot`" style="mask-type: alpha"><image :href="iconUrl('pilot')" data-what="pilot symbol" x="104" y="228" width="72" height="72" /></mask>
      <mask v-for="(url, i) in medalIcons" :id="`${pre}-medal-${i}`" :key="i" style="mask-type: alpha">
        <image :href="url" :data-what="`medal ${i + 1}`" :x="medalX(i) - 14" :y="MEDAL_Y - 14" width="28" height="28" />
      </mask>
    </template>

    <!-- Header: the licence symbol, the title, and a contact chip. -->
    <rect x="36" y="26" width="48" height="48" :fill="accent" :mask="`url(#${pre}-logo)`" />
    <text x="100" y="50" :fill="ink.text" :font-family="`'${SANS_FAMILY}'`" font-size="30" font-weight="700" letter-spacing="5">PILOT LICENCE</text>
    <text x="100" y="74" :fill="ink.dim" :font-family="`'${SANS_FAMILY}'`" font-size="19" font-weight="400" letter-spacing="2">UNION · <tspan :font-family="`'${MONO_FAMILY}'`" font-weight="500">{{ serial }}</tspan></text>
    <g transform="translate(724 28)" fill="none" :stroke="ink.dim" stroke-width="2" opacity="0.8">
      <rect width="60" height="46" rx="8" />
      <path d="M0 16H18V30H0M60 16H42V30H60M30 0V16M30 30V46" />
      <rect x="18" y="16" width="24" height="14" :fill="accent" fill-opacity="0.2" :stroke="accent" />
    </g>
    <line x1="36" y1="100" x2="820" y2="100" :stroke="ink.rule" stroke-width="2" />
    <line x1="36" y1="100" x2="136" y2="100" :stroke="accent" stroke-width="4" />

    <!-- Portrait window: corner ticks, scan lines and a tint toward the pilot's colour. -->
    <rect x="36" y="120" width="216" height="288" :fill="ink.raised" />
    <rect v-if="!portraitUrl" x="104" y="228" width="72" height="72" :fill="ink.dim" :mask="`url(#${pre}-pilot)`" />
    <template v-else>
      <image :href="portraitUrl" data-what="portrait" x="36" y="120" width="216" height="288" preserveAspectRatio="xMidYMid slice" :clip-path="`url(#${pre}-portrait)`" />
      <rect x="36" y="120" width="216" height="288" :fill="`url(#${pre}-tint)`" />
      <rect x="36" y="120" width="216" height="288" :fill="`url(#${pre}-scan)`" opacity="0.22" />
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

    <!-- Footer: barcode of the serial (clear of the cut corner), the medals on the right. -->
    <line x1="36" y1="436" x2="820" y2="436" :stroke="ink.rule" stroke-width="2" />
    <g :fill="ink.text" opacity="0.85">
      <rect v-for="bar in bars" :key="bar.x" :x="36 + bar.x * BAR_UNIT" y="450" :width="bar.w * BAR_UNIT" height="32" />
    </g>
    <g v-for="(url, i) in medalIcons" :key="url + i">
      <polygon :points="hex(medalX(i))" :fill="ink.raised" :stroke="accent" stroke-width="3" />
      <rect :x="medalX(i) - 14" :y="MEDAL_Y - 14" width="28" height="28" :fill="accent" :mask="`url(#${pre}-medal-${i})`" />
    </g>
    <g v-if="more">
      <polygon :points="hex(moreX)" :fill="ink.raised" :stroke="accent" stroke-width="3" />
      <text :x="moreX" :y="MEDAL_Y + 8" text-anchor="middle" :fill="accent" :font-family="`'${MONO_FAMILY}'`" font-size="22" font-weight="700">+{{ more }}</text>
    </g>
  </IdCardFrame>
</template>
