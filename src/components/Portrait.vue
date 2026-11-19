<script setup lang="ts">
import { computed } from 'vue'
import { imageUrl, type FrameArt as Art } from '../images'
import FrameArt from './FrameArt.vue'
import Icon from './Icon.vue'

// A 3:4 image frame. "src" is the stored image path (src/images.ts turns it into a link). Without an image it's a calm
// empty frame with a symbol (a pilot's, unless "icon" names another). "whole" (mech art, usually landscape) shows a
// picture uncropped at its own shape, no bigger than itself and at most 60vh tall; the empty frame stays 3:4.
// "fallback" is a frame's picture (src/images.ts), shown, whole, when there's no image of its own.
const props = withDefaults(defineProps<{ src: string | null; alt: string; icon?: string; whole?: boolean; fallback?: Art | null }>(), { icon: 'pilot' })
const url = computed(() => imageUrl(props.src))
</script>

<template>
  <div class="portrait" :class="{ whole: whole && (url || fallback) }">
    <img v-if="url" :src="url" :alt="alt" />
    <FrameArt v-else-if="fallback" :art="fallback" alt="Frame image" />
    <span v-else class="none" role="img" aria-label="No image"><Icon :name="icon" /></span>
  </div>
</template>

<style scoped>
.portrait {
  display: grid;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--raised);
}

.portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portrait.whole {
  width: fit-content;
  max-width: 100%;
  aspect-ratio: auto;
}

.whole img {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
}

.none {
  display: grid;
  place-items: center;
  color: var(--text-dim);
}

.none .icon {
  width: 40%;
  height: auto;
  aspect-ratio: 1;
}
</style>
