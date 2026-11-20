<script setup lang="ts">
import { computed } from 'vue'
import { MOTTO_MAX } from '../pilotProfile'
import type { Award } from '../commendations'
import { imageUrl } from '../images'
import { pilotSerial } from '../idCard'
import CommendationBadges from './CommendationBadges.vue'
import Portrait from './Portrait.vue'

// The pilot file's cover: a banner strip, the portrait in pilot-colour corner brackets, a classification line, the
// callsign and name, the motto, the status badge and medals, then the key figures. The callsign, name and motto are
// fields while editable. The pilot's colour (--pilot) is decoration only: brackets, rules and bars.
const props = defineProps<{
  id: number
  callsign: string | null
  name: string
  player: string
  portrait: string | null
  banner: string | null
  motto: string | null
  editable: boolean // callsign and name are fields
  mottoEditable: boolean
  badge: { label: string; status: string }
  awards: Award[]
  figures: { label: string; value: string | number; sub?: string; over?: boolean }[]
  joined: boolean // the next-step bar is under it
}>()
const emit = defineEmits<{ text: [column: 'callsign' | 'pilot_name', event: Event]; motto: [event: Event] }>()
const bannerUrl = computed(() => imageUrl(props.banner))
const title = computed(() => props.callsign ?? props.name)
</script>

<template>
  <article class="cover" :class="{ joined }">
    <div class="banner"><img v-if="bannerUrl" :src="bannerUrl" alt="" /></div>
    <div class="cover-body">
      <div class="cover-main">
        <div class="portrait-frame"><div class="pf-in"><Portrait class="portrait" :src="portrait" :alt="`Portrait of ${title}`" /></div></div>
        <div class="cover-text">
          <div class="classification">
            <span class="hide-sm">Union Administrative Department</span>
            <span>Pilot file</span>
            <span class="code">{{ pilotSerial(id) }}</span>
            <span class="actions"><slot name="actions" /></span>
          </div>
          <!-- While editable the callsign is a field, so the page's heading is for screen readers only. -->
          <h1 v-if="editable" class="sr-only">{{ callsign || name || 'My pilot' }}</h1>
          <input v-if="editable" class="inline callsign" type="text" aria-label="Callsign" placeholder="Callsign" :value="callsign ?? ''" @change="emit('text', 'callsign', $event)" />
          <h1 v-else class="callsign">{{ title }}</h1>
          <div class="sep sub">
            <span>
              <input v-if="editable" class="inline name" type="text" aria-label="Name" placeholder="Name" :value="name" @change="emit('text', 'pilot_name', $event)" />
              <template v-else>{{ name }}</template>
            </span>
            <span>Player: {{ player }}</span>
          </div>
          <div v-if="mottoEditable || motto" class="motto">
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
          <div class="badges">
            <span class="badge" :class="badge.status">{{ badge.label }}</span>
            <CommendationBadges :awards="awards" />
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

/* The banner picture, or a quiet pattern in the pilot's colour before they add one. */
.banner {
  position: relative;
  height: 9rem;
  overflow: hidden;
  border-bottom: 2px solid var(--accent);
  background:
    repeating-linear-gradient(135deg, rgb(255 255 255 / 0.035) 0 2px, transparent 2px 16px),
    linear-gradient(100deg, color-mix(in srgb, var(--accent) 30%, var(--void)) 0%, var(--void) 75%);
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

.cover-body {
  position: relative;
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

/* The GM's links, at the line's right end. */
.actions {
  display: flex;
  align-items: stretch;
  gap: var(--space-s);
  margin-left: auto;
  letter-spacing: 0;
}

.actions:empty {
  display: none;
}

.callsign {
  margin: 0;
  color: var(--text);
  font: 800 52px / 1 var(--sans);
  letter-spacing: 0.04em;
}

.sub {
  color: var(--text-dim);
  font-size: var(--fs-m);
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

/* No percentage cap here: against its shrink-to-fit item it would clip the last letters. */
.inline.name {
  max-width: none;
  color: var(--text-dim);
}

.motto {
  max-width: 60ch;
  padding-left: var(--space-m);
  border-left: 3px solid var(--accent);
  color: var(--text-dim);
  font-size: var(--fs-m);
  font-style: italic;
}

.motto .inline {
  max-width: 100%;
  min-width: 14ch;
  color: inherit;
  font: inherit;
}

/* A long motto wraps (a growing textarea, not a one-line box that clips it). */
.motto .motto-input {
  display: block;
  resize: none;
  overflow: hidden;
  overflow-wrap: anywhere;
  line-height: 1.4;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-l);
  margin-top: var(--space-xs);
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

@media (max-width: 48rem) {
  .banner {
    height: 6rem;
  }

  .cover-body {
    padding: 0 var(--space-m) var(--space-l);
  }

  .cover-main {
    grid-template-columns: 6.5rem minmax(0, 1fr);
    gap: 6px var(--space-m);
    margin-top: -2.5rem;
  }

  /* The text column dissolves into the cover grid, so the badges and medals run the full width under the portrait. */
  .cover-text {
    display: contents;
  }

  .portrait-frame {
    grid-row: 1 / span 4;
  }

  .classification {
    margin-top: calc(2.5rem + var(--space-s));
  }

  .classification,
  .callsign,
  .sub,
  .motto {
    grid-column: 2;
  }

  .hide-sm {
    display: none;
  }

  .badges {
    grid-column: 1 / -1;
    margin-top: var(--space-s);
  }

  .callsign {
    font-size: 34px;
  }

  .sub,
  .motto {
    font-size: var(--fs-s);
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
}
</style>
