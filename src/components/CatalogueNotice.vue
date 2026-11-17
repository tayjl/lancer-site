<script setup lang="ts">
// One per page that shows game content (frames, gear, talents...): says so when a read of it failed, so an empty
// picker isn't mistaken for "no content". Cleared by the next successful read (src/catalogue.ts).
import { catalogueError } from '../catalogue'
</script>

<template>
  <p v-if="catalogueError" class="notice warn" role="alert">Game content didn't load: {{ catalogueError }}</p>
</template>
