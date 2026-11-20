<script setup lang="ts">
import { computed, nextTick, reactive, useId, useTemplateRef, watch } from 'vue'
import { MOTTO_MAX, type BannerPosition } from '../pilotProfile'
import type { Award } from '../commendations'
import { imageUrl } from '../images'
import { pilotSerial } from '../idCard'
import CommendationBadges from './CommendationBadges.vue'
import Portrait from './Portrait.vue'

// The pilot file's cover: a banner strip, the portrait in pilot-colour corner brackets, a classification line (with the
// status badge and the "actions" slot at its right), the callsign with the name beside it, the motto, the medals and
// player, then the key figures and (while editing) the "tools" slot. The callsign, name and motto are fields while
// editable. In positioning mode the banner strip is dragged to choose which part of the picture shows. The pilot's colour
// (--pilot) is decoration only: brackets, rules, bars and the motto's quotation marks.
const props = defineProps<{
  id: number
  callsign: string | null
  name: string
  player: string
  portrait: string | null
  banner: string | null
  bannerPosition: BannerPosition
  positioning: boolean // the banner strip is in positioning mode (shown only while there's a banner)
  motto: string | null
  editable: boolean // callsign and name are fields
  mottoEditable: boolean
  badge: { label: string; status: string }
  awards: Award[]
  figures: { label: string; value: string | number; sub?: string; over?: boolean }[]
  joined: boolean // the next-step bar is under it
}>()
// "position" ends positioning mode: the new position to save, or null for Cancel.
const emit = defineEmits<{ text: [column: 'callsign' | 'pilot_name', event: Event]; motto: [event: Event]; position: [position: BannerPosition | null] }>()
const bannerUrl = computed(() => imageUrl(props.banner))
const title = computed(() => props.callsign ?? props.name)

// --- Banner positioning: drag (or arrow keys on the strip) to move the picture, a slider to zoom ---
const strip = useTemplateRef('strip')
const picture = useTemplateRef('picture')
const hintId = useId()
const placing = computed(() => props.positioning && !!bannerUrl.value)
// Just the three values, as the prop may be a bigger object (the whole profile).
const copy = ({ banner_x, banner_y, banner_zoom }: BannerPosition): BannerPosition => ({ banner_x, banner_y, banner_zoom })
const draft = reactive(copy(props.bannerPosition))
watch(placing, async (on) => {
  if (!on) return
  Object.assign(draft, copy(props.bannerPosition))
  await nextTick()
  strip.value?.focus()
})
const shown = computed(() => (placing.value ? draft : props.bannerPosition))
// Zooming from the chosen point keeps that point in place, and the picture still covers the strip.
const bannerStyle = computed(() => {
  const at = `${shown.value.banner_x}% ${shown.value.banner_y}%`
  return { objectPosition: at, transformOrigin: at, transform: `scale(${shown.value.banner_zoom})` }
})
const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10

// A percent step moves the picture by that share of its overflow (how far it sticks out of the strip once scaled), so
// dividing the pointer's movement by the overflow makes the picture follow the pointer 1:1. Moving it right lowers x.
let grabbed: { x: number; y: number; px: number; py: number; overX: number; overY: number } | null = null
function grab(event: PointerEvent) {
  const img = picture.value
  if (!placing.value || event.button !== 0 || !img?.naturalWidth) return
  const scale = Math.max(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight) * draft.banner_zoom
  grabbed = {
    x: draft.banner_x,
    y: draft.banner_y,
    px: event.clientX,
    py: event.clientY,
    overX: img.naturalWidth * scale - img.clientWidth,
    overY: img.naturalHeight * scale - img.clientHeight,
  }
  strip.value?.setPointerCapture(event.pointerId)
}
function drag(event: PointerEvent) {
  if (!grabbed) return
  if (grabbed.overX > 0) draft.banner_x = clamp(grabbed.x - ((event.clientX - grabbed.px) / grabbed.overX) * 100)
  if (grabbed.overY > 0) draft.banner_y = clamp(grabbed.y - ((event.clientY - grabbed.py) / grabbed.overY) * 100)
}
const drop = () => (grabbed = null)

// Arrow keys on the strip itself (not the slider) move the picture the same way round as dragging. Escape cancels.
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') return emit('position', null)
  if (event.target !== strip.value) return
  const step = event.shiftKey ? 10 : 2
  const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
  const move = moves[event.key]
  if (!move) return
  event.preventDefault()
  draft.banner_x = clamp(draft.banner_x + move[0])
  draft.banner_y = clamp(draft.banner_y + move[1])
}
</script>

<template>
  <article class="cover" :class="{ joined, placing }">
    <div
      ref="strip"
      class="banner"
      :role="placing ? 'group' : undefined"
      :tabindex="placing ? 0 : undefined"
      :aria-label="placing ? 'Banner position' : undefined"
      :aria-describedby="placing ? hintId : undefined"
      @pointerdown="grab"
      @pointermove="drag"
      @pointerup="drop"
      @pointercancel="drop"
      @keydown="placing && key($event)"
    >
      <img v-if="bannerUrl" ref="picture" :src="bannerUrl" alt="" draggable="false" :style="bannerStyle" />
      <div v-if="placing" class="placer" @pointerdown.stop>
        <p :id="hintId" class="hint">Drag or use the arrow keys.</p>
        <label class="zoom">
          <span class="label">Zoom</span>
          <input v-model.number="draft.banner_zoom" type="range" min="1" max="3" step="0.05" :aria-valuetext="`${draft.banner_zoom.toFixed(1)} times`" />
        </label>
        <button type="button" class="small primary" @click="emit('position', copy(draft))">Save position</button>
        <button type="button" class="small quiet" @click="emit('position', null)">Cancel</button>
      </div>
    </div>
    <div class="cover-body">
      <div class="cover-main">
        <div class="portrait-frame"><div class="pf-in"><Portrait class="portrait" :src="portrait" :alt="`Portrait of ${title}`" /></div></div>
        <div class="cover-text">
          <div class="classification">
            <span class="hide-sm">Union Administrative Department</span>
            <span>Pilot file</span>
            <span class="code">{{ pilotSerial(id) }}</span>
            <span class="actions">
              <span class="badge" :class="badge.status"><span class="sr-only">Status: </span>{{ badge.label }}</span>
              <slot name="actions" />
            </span>
          </div>
          <!-- While editable the callsign is a field, so the page's heading is for screen readers only. -->
          <h1 v-if="editable" class="sr-only">{{ callsign || name || 'My pilot' }}</h1>
          <div class="names">
            <template v-if="editable">
              <input class="inline callsign" type="text" aria-label="Callsign" placeholder="Callsign" :value="callsign ?? ''" @change="emit('text', 'callsign', $event)" />
              <input class="inline name" type="text" aria-label="Name" placeholder="Name" :value="name" @change="emit('text', 'pilot_name', $event)" />
            </template>
            <template v-else>
              <h1 class="callsign">{{ title }}</h1>
              <span v-if="title !== name" class="name">{{ name }}</span>
            </template>
          </div>
          <div v-if="mottoEditable || motto" class="motto" :class="{ editing: mottoEditable }">
            <textarea
              v-if="mottoEditable"
              class="inline motto-input"
              rows="1"
              aria-label="Motto"
              placeholder="Motto"
              :maxlength="MOTTO_MAX"
              :value="motto ?? ''"
              @keydown.enter.prevent="($event.target as HTMLTextAreaElement).blur()"
              @change="emit('motto', $event)"
            ></textarea>
            <template v-else>{{ motto }}</template>
          </div>
          <div class="foot">
            <CommendationBadges :awards="awards" />
            <span class="player">Player: {{ player }}</span>
          </div>
        </div>
      </div>
      <dl class="figures">
        <div v-for="figure in figures" :key="figure.label" class="figure">
          <dt class="label">{{ figure.label }}</dt>
          <dd class="value num" :class="{ over: figure.over }">{{ figure.value }}</dd>
          <dd v-if="figure.sub" class="sub-note"><span class="num">{{ figure.sub }}</span></dd>
        </div>
      </dl>
      <!-- While editing: the portrait, banner and colour controls, one per column. -->
      <div v-if="$slots.tools" class="tools"><slot name="tools" /></div>
    </div>
  </article>
</template>

<style scoped>
.cover {
  --accent: var(--pilot, var(--edge));
  --grid: rgb(255 255 255 / 0.035);
  overflow: hidden;
  border: 1px solid var(--rule);
  border-top: 3px solid var(--accent);
  border-radius: var(--radius);
  background: var(--panel);
  overflow-wrap: anywhere; /* a long unbroken name wraps instead of widening the page */
}

/* With the next-step bar under it, the two read as one block. */
.cover.joined {
  border-radius: var(--radius) var(--radius) 0 0;
}

/* The banner picture, or before they add one a plain wash of the pilot's colour into the dark, with a soft glow behind
   the portrait. */
.banner {
  position: relative;
  height: 9rem;
  overflow: hidden;
  border-bottom: 2px solid var(--accent);
  background:
    radial-gradient(40% 90% at 12% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent),
    linear-gradient(100deg, color-mix(in srgb, var(--accent) 30%, var(--void)), var(--void) 75%);
}

.banner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banner::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: 45%;
  background: linear-gradient(transparent, var(--panel));
}

/* Positioning: the strip comes in front of the portrait so all of it can be seen and dragged. */
.placing .banner {
  z-index: 3;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.placing .banner:active {
  cursor: grabbing;
}

/* The cover clips anything outside the strip, so its focus ring goes inside. */
.banner:focus-visible {
  outline-offset: -2px;
}

/* The zoom slider and buttons, over the strip's faded foot (which the portrait covers otherwise). */
.placer {
  position: absolute;
  z-index: 1;
  right: var(--space-s);
  bottom: var(--space-s);
  display: flex;
  align-items: center;
  gap: var(--space-s) var(--space-m);
  padding: var(--space-xs) var(--space-s);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
  cursor: auto;
}

.placer .hint {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--fs-xs);
}

.zoom {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-s);
}

.zoom input {
  min-width: 3rem;
  flex: 1;
  accent-color: var(--lilac);
}

.placer button {
  flex: none;
}

/* flow-root: the portrait's pull-up stays inside, so the grid starts under the banner rather than crossing it. */
.cover-body {
  position: relative;
  display: flow-root;
  padding: 0 var(--space-xl) var(--space-xl);
  background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 32px 32px;
}

.cover-main {
  position: relative;
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr);
  align-items: start;
  gap: var(--space-xl);
  margin-top: -4.5rem;
}

/* The portrait, in four corner brackets (two on each of two wrappers). */
.portrait-frame,
.pf-in {
  position: relative;
}

.portrait-frame::before,
.portrait-frame::after,
.pf-in::before,
.pf-in::after {
  content: '';
  position: absolute;
  z-index: 2;
  width: 20px;
  height: 20px;
  border: 2px solid var(--accent);
  pointer-events: none;
}

.portrait-frame::before { top: -7px; left: -7px; border-right: 0; border-bottom: 0; }
.portrait-frame::after { right: -7px; bottom: -7px; border-top: 0; border-left: 0; }
.pf-in::before { top: -7px; right: -7px; border-bottom: 0; border-left: 0; }
.pf-in::after { bottom: -7px; left: -7px; border-top: 0; border-right: 0; }

.portrait {
  border-radius: 0;
}

.cover-text {
  display: grid;
  gap: var(--space-s);
  min-width: 0;
  margin-top: calc(4.5rem + var(--space-l));
}

/* Small mono: where the file comes from and its number. */
.classification {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px var(--space-m);
  color: var(--text-dim);
  font: 400 var(--fs-xs) / 1.4 var(--mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.classification .code {
  letter-spacing: 0.1em;
}

/* The status badge, then the GM's links, at the line's right end. */
.actions {
  display: flex;
  align-items: stretch;
  gap: var(--space-s);
  margin-left: auto;
  letter-spacing: 0;
}

.actions .badge {
  align-self: center;
}

/* The callsign, then the name smaller and dim on the same baseline, wrapping under it when there isn't room. */
.names {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px var(--space-l);
}

.callsign {
  margin: 0;
  color: var(--text);
  font: 800 52px / 1 var(--sans);
  letter-spacing: 0.04em;
}

.name {
  color: var(--text-dim);
  font: 600 24px / 1.2 var(--sans);
  letter-spacing: 0.02em;
}

/* Callsign and name: plain text with a faint underline that says they can be edited. */
.inline {
  min-height: 0;
  min-width: 8ch;
  max-width: 100%;
  margin-left: -6px;
  padding: 1px 6px;
  border-color: transparent;
  border-bottom-color: var(--rule);
  background: none;
  /* Hug the text. shortcut: Firefox has no field-sizing and keeps its default ~20ch width; fine until Firefox ships it. */
  width: auto;
  field-sizing: content;
}

.inline:hover {
  border-color: var(--rule);
}

/* The motto in quotation marks of the pilot's colour, which aren't part of the stored text. */
.motto {
  max-width: 60ch;
  color: var(--text-dim);
  font-size: var(--fs-l);
  font-style: italic;
  line-height: 1.4;
}

.motto::before,
.motto::after {
  color: var(--accent);
}

.motto::before {
  content: '“';
}

.motto::after {
  content: '”';
}

/* While editing, the marks sit either side of the growing field (level with its text), the closing one by its last line. */
.motto.editing {
  display: flex;
  align-items: flex-start;
}

.motto.editing::before {
  padding-top: 2px;
}

.motto.editing::after {
  align-self: flex-end;
  padding-bottom: 2px;
}

.motto .inline {
  min-width: 14ch;
  margin-left: 0;
  padding: 1px 2px;
  color: inherit;
  font: inherit;
}

/* No underline: the marks and the placeholder show it can be filled in. Hover and focus still outline it. */
.motto .inline:not(:hover, :focus) {
  border-color: transparent;
}

/* A long motto wraps (a growing textarea, not a one-line box that clips it). */
.motto .motto-input {
  flex: 0 1 auto; /* only as wide as its text, so the closing mark follows the last word */
  resize: none;
  overflow: hidden;
  overflow-wrap: anywhere;
}

/* The medals, then the player at the right end, under the actions above. */
.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-l);
}

.player {
  margin-left: auto;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.figures {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  margin: var(--space-xl) 0 0;
  border-top: 1px solid var(--rule);
  overflow-wrap: normal; /* a figure never breaks mid-word */
}

.figure {
  display: grid;
  align-content: start;
  gap: 2px;
  padding: var(--space-m) var(--space-l) 0;
  border-left: 1px solid var(--rule);
}

.figure:first-child {
  padding-left: 0;
  border-left: 0;
}

.figure::before {
  content: '';
  width: 14px;
  height: 2px;
  margin-bottom: var(--space-xs);
  background: var(--accent);
}

.figure dd,
.figure dt {
  margin: 0;
}

.value {
  order: 1;
  font: 700 30px / 1.1 var(--mono);
}

.value.over {
  color: var(--danger);
}

.figure .label {
  order: 2;
}

.sub-note {
  order: 3;
  color: var(--text-dim);
  font-size: var(--fs-xs);
}

/* One row at natural widths (wrapping on phones), each control straight under its label and all starting on one line. */
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-l) var(--space-xl);
  margin-top: var(--space-xl);
  padding-top: var(--space-l);
  border-top: 1px solid var(--rule);
  overflow-wrap: normal;
}

@media (max-width: 48rem) {
  .banner {
    height: 6rem;
  }

  /* One row across the strip's foot, the slider taking what's left. The hint still describes the strip. */
  .placer {
    left: var(--space-xs);
    right: var(--space-xs);
    bottom: var(--space-xs);
    gap: var(--space-s);
  }

  /* The slider shrinks first so both buttons stay inside the strip; the hint and "Zoom" stay for screen readers. */
  .zoom,
  .zoom input {
    min-width: 0;
  }

  .placer .hint,
  .zoom .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .cover-body {
    padding: 0 var(--space-m) var(--space-l);
  }

  .cover-main {
    grid-template-columns: 6.5rem minmax(0, 1fr);
    gap: 6px var(--space-m);
    margin-top: -2.5rem;
  }

  /* The text column dissolves into the cover grid, so the medals and player run the full width under the portrait. */
  .cover-text {
    display: contents;
  }

  .portrait-frame {
    grid-row: 1 / span 3;
  }

  .classification {
    margin-top: calc(2.5rem + var(--space-s));
  }

  .classification,
  .names,
  .motto {
    grid-column: 2;
  }

  .hide-sm {
    display: none;
  }

  .foot {
    grid-column: 1 / -1;
    margin-top: var(--space-s);
  }

  /* The player on a line of its own. */
  .player {
    flex-basis: 100%;
    margin-left: 0;
  }

  .callsign {
    font-size: 34px;
  }

  .name {
    font-size: 20px;
  }

  .motto {
    font-size: var(--fs-m);
  }

  /* Each figure takes the width its words need, the rest shared out between them. */
  .figures {
    grid-auto-columns: auto;
    justify-content: space-between;
    margin-top: var(--space-l);
  }

  .figure {
    padding: var(--space-s) 6px 0;
  }

  .figure:first-child {
    padding-left: 0;
  }

  .value {
    font-size: 22px;
  }

  .sub-note {
    display: none;
  }

  .figure .label {
    letter-spacing: 0.02em;
  }
}

@media (max-width: 40rem) {
  .callsign {
    font-size: 30px;
  }

  .name {
    font-size: 18px;
  }
}
</style>
