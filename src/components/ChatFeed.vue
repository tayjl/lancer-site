<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { hideCutLines, parseChat } from '../chat'
import ChatLine from './ChatLine.vue'

// A fake live chat, like the one on the login screen: messages arrive one at a time and the newest
// sits at the bottom. Old messages drop off the top as whole lines ("tail" style, see src/chat.ts).
// "delay" is the gap between messages in milliseconds. The first "quickLines" lines (e.g. a MOTD
// block) come out much faster, so the chat gets going straight away.
const props = defineProps<{ text: string; delay?: number; quickLines?: number }>()
const QUICK_DELAY = 300

const lines = parseChat(props.text)
const shown = ref(0)
const feed = useTemplateRef('feed')
let timer: number | undefined

const hideCut = () => hideCutLines(feed.value)
watch(shown, hideCut, { flush: 'post' })

onMounted(() => {
  window.addEventListener('resize', hideCut)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    shown.value = lines.length
    return
  }
  const next = () => (shown.value < (props.quickLines ?? 0) ? QUICK_DELAY : (props.delay ?? 1100))
  const step = () => {
    shown.value++
    if (shown.value < lines.length) timer = window.setTimeout(step, next())
  }
  timer = window.setTimeout(step, next())
})

onUnmounted(() => {
  window.clearTimeout(timer)
  window.removeEventListener('resize', hideCut)
})
</script>

<template>
  <!-- Flavour text only, so screen readers skip it. -->
  <div ref="feed" class="feed" aria-hidden="true">
    <div class="feed-lines">
      <p v-for="(line, i) in lines.slice(0, shown)" :key="i" :class="line.tone"><ChatLine :line="line" /></p>
    </div>
  </div>
</template>

<style scoped>
/* Same "tail" layout as the login log: the height is a whole number of lines and the newest line sits at
   the bottom. The auto margin keeps lines at the top until they overflow. */
.feed {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
  height: round(down, 100%, 1lh);
  overflow: hidden;
  font: 400 0.8125rem / 1.25rem var(--mono);
}

.feed-lines {
  margin-bottom: auto;
}

.feed p {
  max-width: none;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (min-width: 48rem) {
  .feed {
    font-size: 0.875rem;
    line-height: 1.5rem;
  }
}
</style>
