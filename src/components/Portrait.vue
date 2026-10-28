<script setup lang="ts">
// A 3:4 image frame. Without an image it shows an empty dashed frame instead.
defineProps<{ src: string | null; alt: string }>()
</script>

<template>
  <div class="portrait">
    <img v-if="src" :src="src" :alt="alt" />
    <span v-else class="dim">no image<br />on file</span>
  </div>
</template>

<style scoped>
.portrait {
  display: grid;
  place-items: center;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 1px dashed var(--rule);
  font-size: 0.75rem;
  text-align: center;
}

.portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
