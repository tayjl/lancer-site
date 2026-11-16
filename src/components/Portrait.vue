<script setup lang="ts">
import Icon from './Icon.vue'

// A 3:4 image frame. Without an image it's a calm empty frame with a symbol (a pilot's, unless "icon" names another).
withDefaults(defineProps<{ src: string | null; alt: string; icon?: string }>(), { icon: 'pilot' })
</script>

<template>
  <div class="portrait">
    <img v-if="src" :src="src" :alt="alt" />
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
