<script setup lang="ts">
import { ref, watch } from 'vue'
import { frameArtUrl, type FrameArt } from '../images'

// A frame's picture (src/images.ts: an owner's upload, else COMP/CON's bundled art), loaded when it's shown. Classes and
// attributes go on the <img>. While there's no picture (none exists, or it's still loading) the slot shows instead.
defineOptions({ inheritAttrs: false })
const props = defineProps<{ art?: FrameArt | null; alt?: string }>()

const url = ref<string | null>(null)
let run = 0
watch(
  () => props.art,
  async (art) => {
    const mine = ++run
    const next = await frameArtUrl(art)
    if (mine === run) url.value = next
  },
  { immediate: true },
)
</script>

<template>
  <img v-if="url" v-bind="$attrs" :src="url" :alt="alt ?? ''" decoding="async" />
  <slot v-else />
</template>
