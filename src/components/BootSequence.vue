<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
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
// while the chat is still arriving.
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

const artLines = toLines(art).map(artParts)
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
const hideCutMessages = () => hideCutLines(log.value)

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

const artShown = computed(() => visible(introLines.length, artLines.length))
</script>

<template>
  <!-- Both parts are flavour text only, so screen readers skip them. -->
  <div class="art-slot" aria-hidden="true" @click="skip">
    <!-- Every art line is laid out from the start (just hidden), so the space is reserved.
         Kept on one line: inside <pre>, any extra line break would show up as a blank line. -->
    <pre class="art art-full"><span v-for="(parts, i) in artLines" :key="i" class="art-line" :class="{ waiting: i >= artShown }"><span v-for="(part, j) in parts" :key="j" :class="part.tone">{{ part.text }}</span></span></pre>
    <!-- Only one of these two is shown, depending on the column's width (see the @container rule). -->
    <pre class="art art-small"><span v-for="(parts, i) in smallArtLines" :key="i" class="art-line" :class="{ waiting: i >= artShown }"><span v-for="(part, j) in parts" :key="j" :class="part.tone">{{ part.text }}</span></span></pre>
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
.art {
  position: relative;
  margin: 0;
  font-family: var(--mono);
  font-size: min(100cqi / 46.9, (100dvh - 20rem) / 31.05, 16px);
  font-size: round(down, min(100cqi / 46.9, (100dvh - 20rem) / 31.05, 16px), 1px);
  line-height: 1.15;
  line-height: round(1.15em, 1px);
  animation: glitch 6s steps(1, end) 2s infinite; /* style.css */
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
  .art {
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
