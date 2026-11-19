<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { imageUrl } from '../images'
import Icon from './Icon.vue'

// A pilot's 3:4 portrait frame. "src" is the stored image path (src/images.ts turns it into a link). Without an image,
// or when the file is gone, it's a calm empty frame with the pilot symbol. (Mechs use MechImage.vue.)
const props = defineProps<{ src: string | null; alt: string }>()
const url = computed(() => imageUrl(props.src))
const failed = ref(false)
watch(() => props.src, () => (failed.value = false))
</script>

<template>
  <div class="portrait">
    <img v-if="url && !failed" :src="url" :alt="alt" @error="failed = true" />
    <span v-else class="none" role="img" aria-label="No image"><Icon name="pilot" /></span>
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
