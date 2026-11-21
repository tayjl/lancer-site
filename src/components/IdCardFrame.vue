<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useCopyLink } from '../copyLink'
import { cardInk, cardToPng, saveBlob } from '../idCardExport'
import { supabase } from '../lib/supabaseClient'
import Icon from './Icon.vue'

// What the two ID cards share (PilotIdCard.vue, MechIdCard.vue): one SVG, 856 x 540, with the top-right and bottom-left
// corners cut off, a faint 32px grid, a static diagonal sheen and edge light in the card's accent colour (the cut corners
// with a soft glow, marks at the two square corners), and the outline. The card draws the rest in the slot ("defs" for
// its own clips and masks; "<prefix>-scan" and "<prefix>-tint" are here for its picture window). It also owns "Download
// card" (in the section head, "#<extra>", so it works while the section is folded; no extra, no button, as in the pilot
// lists) and the silent save for link previews.
const props = defineProps<{
  prefix: string // the start of every id in the SVG, unique on the page
  extra?: string // the section head's spot for the button (FileSection.vue)
  label: string // the card read out for screen readers
  accent: string
  filename: string
  note?: string
  fingerprint: string // a stamp of everything the card shows
  saveable: boolean // the card shows saved, public data (approved or dead, no open change on screen, content loaded)
  cardVersion?: string | null // the fingerprint of the picture saved to storage
  savePath?: string | null // where to save the picture; null when this viewer may not
  link?: RouteLocationRaw // the shareable page with a link preview (approved or dead pilots): adds "Copy link"
}>()
const emit = defineEmits<{ cardSaved: [version: string] }>()

const ink = cardInk()
const CUT = 48
const outline = `M0 0H${856 - CUT}L856 ${CUT}V540H${CUT}L0 ${540 - CUT}Z`
const cuts = `M${856 - CUT} 0L856 ${CUT}M0 ${540 - CUT}L${CUT} 540`
const url = (name: string) => `url(#${props.prefix}-${name})`

// Download card
const svg = useTemplateRef<SVGSVGElement>('svg')
const busy = ref(false)
const result = ref<{ ok: boolean; text: string } | null>(null)
async function download() {
  if (!svg.value || busy.value) return
  busy.value = true
  result.value = null
  try {
    const { blob, dropped } = await cardToPng(svg.value)
    saveBlob(blob, props.filename)
    result.value = { ok: true, text: dropped.length ? `Downloaded, without the ${[...new Set(dropped)].join(' and ')} (it couldn't be fetched).` : 'Downloaded' }
  } catch (error) {
    result.value = { ok: false, text: `Not downloaded: ${(error as Error).message || 'the card could not be drawn.'}` }
  }
  busy.value = false
}

// "Copy link" copies the registry address, which has the Discord preview: My pilot's own address (/pilot/...) is the
// same for every player and shows whoever opens it their own pilot.
const { copied, copyLink } = useCopyLink()

// Discord link previews need a picture at a URL, and the Worker is too small to draw one. So the page saves the card it
// draws to storage (silently, 2s after it settles) when what it shows has changed; the parent then saves the fingerprint,
// which is how the Worker builds a versioned link that Discord refreshes.
let timer: ReturnType<typeof setTimeout> | undefined
const tried = new Set<string>() // at most once per fingerprint per page view
async function saveCard(version: string) {
  try {
    await document.fonts.ready
    if (!svg.value || !props.savePath) return
    const { blob } = await cardToPng(svg.value, 1)
    if (blob.size > 1_000_000) return
    const { error } = await supabase.storage.from('character-images').upload(props.savePath, blob, { upsert: true, contentType: 'image/png' })
    if (error) throw error
    emit('cardSaved', version)
  } catch (error) {
    console.warn('Card picture not saved', error)
  }
}
watch(
  [() => props.fingerprint, () => props.savePath, () => props.cardVersion, () => props.saveable],
  () => {
    clearTimeout(timer)
    const version = props.fingerprint
    if (!props.savePath || !props.saveable || version === props.cardVersion || tried.has(version)) return
    timer = setTimeout(() => {
      tried.add(version)
      void saveCard(version)
    }, 2000)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <section class="panel id-panel">
    <!-- The button and its result sit in the section's head (FileSection.vue), so both show while the section is folded. -->
    <Teleport v-if="extra" defer :to="`#${extra}`">
      <span v-if="result" class="result" :class="{ error: !result.ok }" :role="result.ok ? 'status' : 'alert'">{{ result.text }}</span>
      <span v-if="link" aria-live="polite"><button type="button" class="quiet small" @click="copyLink(link)"><Icon name="link" />{{ copied || 'Copy link' }}</button></span>
      <button type="button" class="small" :disabled="busy" @click="download">{{ busy ? 'Drawing…' : 'Download card' }}</button>
    </Teleport>
    <p v-if="note" class="note">{{ note }}</p>
    <svg ref="svg" class="card" viewBox="0 0 856 540" role="img" :aria-label="label" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath :id="`${prefix}-shape`"><path :d="outline" /></clipPath>
        <!-- A faint grid under everything, and scan lines for the picture window. -->
        <pattern :id="`${prefix}-grid`" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" :stroke="ink.dim" stroke-width="1" /></pattern>
        <pattern :id="`${prefix}-scan`" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.5" fill="#000" /></pattern>
        <!-- A static sheen in the accent colour, and a fade toward it up the picture. -->
        <linearGradient :id="`${prefix}-sheen`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" :stop-color="accent" stop-opacity="0.16" />
          <stop offset="0.35" :stop-color="accent" stop-opacity="0" />
          <stop offset="0.7" :stop-color="accent" stop-opacity="0.07" />
          <stop offset="1" :stop-color="accent" stop-opacity="0" />
        </linearGradient>
        <linearGradient :id="`${prefix}-tint`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" :stop-color="accent" stop-opacity="0" />
          <stop offset="1" :stop-color="accent" stop-opacity="0.32" />
        </linearGradient>
        <filter :id="`${prefix}-glow`" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5" /></filter>
        <slot name="defs" />
      </defs>

      <g :clip-path="url('shape')">
        <rect width="856" height="540" :fill="ink.panel" />
        <rect width="856" height="540" :fill="url('grid')" opacity="0.18" />
        <rect width="856" height="540" :fill="url('sheen')" />

        <!-- Edge light: the cut corners in the accent colour with a soft glow, and marks at the two square corners. -->
        <g fill="none" :stroke="accent" stroke-width="4" stroke-linecap="square">
          <g :filter="url('glow')" opacity="0.7"><path :d="`${cuts}M0 0H150M0 0V90M856 540H706M856 540V450`" /></g>
          <path :d="cuts" />
          <path d="M14 56V14H56M842 484V526H800" stroke-width="3" />
        </g>

        <slot />
      </g>
      <path :d="outline" fill="none" :stroke="ink.rule" stroke-width="3" />
    </svg>
  </section>
</template>

<style scoped>
.card {
  display: block;
  width: 100%;
  max-width: 36rem;
  height: auto;
  margin: 0 auto;
}

.note,
.result {
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.note {
  margin: 0 0 var(--space-m);
}

.result.error {
  color: var(--danger);
}
</style>
