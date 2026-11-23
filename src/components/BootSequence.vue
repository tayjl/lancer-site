<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
// The boot text and art come from COMP/CON's HORUS start-up log, by Massif Press (GPL-3.0).
import art from '../assets/boot/art.txt?raw'
// The chat is our own. src/chat.ts explains its format.
import chat from '../assets/boot/chat.txt?raw'
import connect from '../assets/boot/connect.txt?raw'
import intro from '../assets/boot/intro.txt?raw'
import { hideCutLines, parseChat } from '../chat'
import ChatLine from './ChatLine.vue'

// The HOR_OS boot scrawl: the art (top) and the terminal log (middle). The login page
// lays them out with the Uplink bar underneath. Any key or a click skips to the end, and it's
// instant for reduced motion. "done" fires when the log finishes, so the button can appear
// while the chat is still arriving. With a "link" (the home page's), the art opens that page once the whole boot has played.
const toLines = (text: string) => text.replace(/\r/g, '').trimEnd().split('\n')

const introLines = toLines(intro)
const connectLines = toLines(connect)

// Splits each art line so the shading, the arrows and the tagged words can each have their own colour.
// The first group lists the phrases shown in rose: update it if you change those words in art.txt.
const ART_PARTS = /(kostutet distro|GREETINGS FROM KOS ! !|THE RODMIN COLLECTIVE)|(v3\.6c)|([░▒▓]+)|([<>]+)/g
function artParts(line: string) {
  const parts: { text: string; tone?: string }[] = []
  let end = 0
  for (const match of line.matchAll(ART_PARTS)) {
    if (match.index > end) parts.push({ text: line.slice(end, match.index) })
    const tone = match[1] ? 'rose' : match[2] ? 'tag' : match[3] ? 'shade' : 'lilac'
    parts.push({ text: match[0], tone })
    end = match.index + match[0].length
  }
  if (end < line.length) parts.push({ text: line.slice(end) })
  return parts
}

// The logo (the eye) is the only clickable part of the art. Its columns per row: [from, to). Rows 1-6 are the wide top,
// the rest the narrow middle. Update these if art.txt changes.
const EYE_TOP = 1
const EYE_ROWS = 15
const eyeCols = (row: number) => (row <= 6 ? [26, 57] : [35, 47])
type Part = { text: string; tone?: string; eye?: boolean }
function withEye(parts: Part[], row: number): Part[] {
  if (row < EYE_TOP || row > EYE_ROWS) return parts
  const [from, to] = eyeCols(row)
  const out: Part[] = []
  let col = 0
  for (const part of parts) {
    const cuts = [0, from - col, to - col, part.text.length].map((c) => Math.min(Math.max(c, 0), part.text.length))
    for (let k = 0; k < 3; k++) {
      const text = part.text.slice(cuts[k], cuts[k + 1])
      if (text) out.push({ text, tone: part.tone, eye: k === 1 && !part.tone })
    }
    col += part.text.length
  }
  return out
}

const artLines = toLines(art).map((line, i) => withEye(artParts(line), i))
// Small phones get the art without the arrow banner at the bottom (everything from the first ">>>>" line on).
const bannerStart = toLines(art).findIndex((line) => line.includes('>>>>'))
const smallArtLines = bannerStart === -1 ? artLines : artLines.slice(0, bannerStart)

const chatLines = parseChat(chat)

function logTone(line: string) {
  if (line.includes('INC OVERRIDE')) return 'rose'
  if (/^>\/\/|done$|^connection established|^MOTD:/.test(line)) return 'lilac'
  if (/^-+$/.test(line)) return 'divider'
  return undefined
}

// How long to wait before each line, in milliseconds. The art pours out much faster than the text.
const delays = [
  ...introLines.map(() => 320),
  ...artLines.map(() => 35),
  ...connectLines.map(() => 260),
]
const CHAT_DELAY = 1100

defineProps<{ link?: RouteLocationRaw }>()
const emit = defineEmits<{ done: [] }>()
const shown = ref(0)
const chatShown = ref(0)
const log = useTemplateRef('log')
let timer: number | undefined
let chatTimer: number | undefined
let booted = false

function finishBoot() {
  if (booted) return
  booted = true
  window.clearTimeout(timer)
  shown.value = delays.length
  emit('done')
  chatTimer = window.setInterval(() => {
    chatShown.value++
    if (chatShown.value === chatLines.length) skip()
  }, CHAT_DELAY)
}

function skip() {
  finishBoot()
  window.clearInterval(chatTimer)
  window.removeEventListener('keydown', skip)
  chatShown.value = chatLines.length
}

function step() {
  shown.value++
  if (shown.value === delays.length) return finishBoot()
  timer = window.setTimeout(step, delays[shown.value])
}

// So the log always starts on a whole message (see hideCutLines in src/chat.ts).
// Also pins the log to its newest line by scrolling, in case a browser lets overflow from
// "justify-content: flex-end" be scrolled (harmless where it can't be: there's nothing to scroll).
function hideCutMessages() {
  if (log.value) log.value.scrollTop = log.value.scrollHeight
  hideCutLines(log.value)
}

// "post" runs it after Vue has added the new lines to the page.
watch([shown, chatShown], hideCutMessages, { flush: 'post' })

onMounted(() => {
  window.addEventListener('resize', hideCutMessages)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return skip()
  window.addEventListener('keydown', skip)
  timer = window.setTimeout(step, delays[0])
})

onUnmounted(() => {
  window.clearTimeout(timer)
  window.clearInterval(chatTimer)
  window.removeEventListener('keydown', skip)
  window.removeEventListener('resize', hideCutMessages)
})

const visible = (start: number, count: number) => Math.min(Math.max(shown.value - start, 0), count)

// The whole boot, chat included, has played or been skipped (at once for reduced motion).
const finished = computed(() => chatShown.value === chatLines.length)
const artShown = computed(() => visible(introLines.length, artLines.length))
</script>

<template>
  <!-- Both parts are flavour text only, so screen readers skip them (aria-hidden is on the <pre>s, never around a link). -->
  <div class="art-slot" @click="skip">
    <!-- Every art line is laid out from the start (just hidden), so the space is reserved.
         Kept on one line: inside <pre>, any extra line break would show up as a blank line. -->
    <div class="art-wrap art-full">
      <pre class="art" aria-hidden="true"><span v-for="(parts, i) in artLines" :key="i" class="art-line" :class="{ waiting: i >= artShown }"><span v-for="(part, j) in parts" :key="j" :class="[part.tone, { eye: part.eye }]">{{ part.text }}</span></span></pre>
      <RouterLink v-if="link && finished" :to="link" class="eye-link" aria-label="Pithub" />
    </div>
    <!-- Only one of these two is shown, depending on the column's width (see the @container rule). -->
    <div class="art-wrap art-small">
      <pre class="art" aria-hidden="true"><span v-for="(parts, i) in smallArtLines" :key="i" class="art-line" :class="{ waiting: i >= artShown }"><span v-for="(part, j) in parts" :key="j" :class="[part.tone, { eye: part.eye }]">{{ part.text }}</span></span></pre>
      <RouterLink v-if="link && finished" :to="link" class="eye-link" aria-label="Pithub" tabindex="-1" />
    </div>
  </div>

  <div ref="log" class="log" aria-hidden="true" @click="skip">
    <div class="log-lines">
      <p v-for="(line, i) in introLines.slice(0, visible(0, introLines.length))" :key="`intro${i}`" :class="logTone(line)">
        {{ line }}
      </p>
      <p
        v-for="(line, i) in connectLines.slice(0, visible(introLines.length + artLines.length, connectLines.length))"
        :key="`connect${i}`"
        :class="[logTone(line), { gap: i === 0 }]"
      >
        {{ line }}
      </p>
      <!-- The tag and text sit on one line, because the log keeps spaces exactly as written. -->
      <p
        v-for="(line, i) in chatLines.slice(0, chatShown)"
        :key="`chat${i}`"
        class="chat-line"
        :class="[line.tone, { gap: i === 0 }]"
      >
        <ChatLine :line="line" />
      </p>
    </div>
  </div>
</template>

<style scoped>
.art-slot {
  display: flex;
  justify-content: center;
  padding: 1.25rem 0;
}

/* The art is 80 columns of Cascadia Mono (0.586em each, so 46.9em wide) and 27 lines at
   1.15 line height (31.05em tall). It fills the column's width but leaves room for the log below
   (see .login in LoginView), and tops out at 16px. Sizes are rounded to whole pixels so the
   block characters stay sharp; the first lines are the fallback for older browsers. */
.art-wrap {
  position: relative;
  font-family: var(--mono);
  font-size: min(100cqi / 46.9, (100dvh - 20rem) / 31.05, 16px);
  font-size: round(down, min(100cqi / 46.9, (100dvh - 20rem) / 31.05, 16px), 1px);
  line-height: 1.15;
  line-height: round(1.15em, 1px);
}

.art {
  margin: 0;
  font: inherit;
  animation: glitch 6s steps(1, end) 2s infinite; /* style.css */
}

/* Covers just the eye: rows 1-15, from column 26 to 57 (the wide top is the box, the narrow middle sits inside it). */
.eye-link {
  position: absolute;
  top: 1lh;
  left: 26ch;
  width: 31ch;
  height: 15lh;
  /* Wide top, narrow middle, so the letters beside the eye aren't part of the link. */
  clip-path: polygon(0 0, 100% 0, 100% 6lh, 21ch 6lh, 21ch 100%, 9ch 100%, 9ch 6lh, 0 6lh);
}

.art-wrap:has(.eye-link:hover) .eye,
.art-wrap:has(.eye-link:focus-visible) .eye {
  color: var(--danger);
}

.art-line {
  display: block;
}

/* Small phones (a column under 28rem) show the art without the banner: 23 lines, 26.45em tall. */
.art-small {
  display: none;
  font-size: min(100cqi / 46.9, (100dvh - 20rem) / 26.45, 16px);
  font-size: round(down, min(100cqi / 46.9, (100dvh - 20rem) / 26.45, 16px), 1px);
}

@container (width < 28rem) {
  .art-full {
    display: none;
  }

  .art-small {
    display: block;
  }
}

.waiting {
  visibility: hidden;
}

/* The terminal between the art and the Uplink button. It works like "tail": its height is cut down to
   a whole number of lines and the newest line sits at the bottom, so older lines drop off the top
   without ever being cut in half. Every line is the same height (line-height is a fixed rem value,
   even for the smaller chat text), which is what keeps the lines whole. */
.log {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-self: end;
  height: 100%;
  height: round(down, 100%, 1lh);
  overflow: hidden;
  font: 400 0.8125rem / 1.25rem var(--mono);
}

/* While everything fits, this auto margin keeps the lines at the top. Once they overflow,
   it collapses and the newest lines stay at the bottom. */
.log-lines {
  margin-bottom: auto;
}

.log p {
  max-width: none;
  min-height: 1lh; /* so an empty line in the text files shows as a blank line */
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* A blank line's worth of space. */
.log .gap {
  margin-top: 1lh;
}

.log .chat-line {
  font-size: 0.75rem;
}

/* Dashed dividers get cut off on narrow screens rather than wrapping onto a second line. */
.log .divider {
  overflow: hidden;
  color: var(--text-dim);
  white-space: nowrap;
}

.shade {
  color: color-mix(in srgb, var(--lilac) 40%, var(--void));
}

.tag {
  background: var(--lilac);
  color: var(--void);
}

@media (min-width: 48rem) {
  .log {
    font-size: 0.9375rem;
    line-height: 1.5rem;
  }

  .log .chat-line {
    font-size: 0.875rem;
  }
}

/* Too short to pin anything (e.g. a phone held sideways): the page just scrolls normally. */
@media (max-height: 30rem) {
  .art-wrap {
    font-size: round(down, 100cqi / 46.9, 1px);
  }

  .log {
    display: block;
    height: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .art {
    animation: none;
  }
}
</style>
