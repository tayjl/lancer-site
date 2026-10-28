<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { hideCutLines, parseChat } from '../chat'
import ChatLine from './ChatLine.vue'

// A fake live chat, like the one on the login screen: messages arrive one at a time and the newest
// sits at the bottom. Old messages drop off the top as whole lines ("tail" style, see src/chat.ts).
const props = defineProps<{ text: string; delay?: number }>()

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
  timer = window.setInterval(() => {
    shown.value++
    if (shown.value === lines.length) window.clearInterval(timer)
  }, props.delay ?? 1100)
})

onUnmounted(() => {
  window.clearInterval(timer)
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
