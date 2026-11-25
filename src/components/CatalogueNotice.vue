<script setup lang="ts">
// One per page that shows game content (frames, gear, talents...): says so when a read of it failed, so an empty
// picker isn't mistaken for "no content". Retry reads it all again (src/catalogue.ts) and shows Loading… until done.
import { catalogueError, retrying, retryCatalogues } from '../catalogue'
</script>

<template>
  <p v-if="catalogueError || retrying" class="notice warn" role="alert">
    <template v-if="catalogueError">Game content didn't load: {{ catalogueError }}</template>
    <button type="button" class="small" :disabled="retrying" @click="retryCatalogues">{{ retrying ? 'Loading…' : 'Retry' }}</button>
  </p>
</template>
