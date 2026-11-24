<script setup lang="ts">
// One per page that shows game content (frames, gear, talents...): says so when a read of it failed, so an empty
// picker isn't mistaken for "no content". Cleared by the next successful read (src/catalogue.ts). A page that can
// read it again passes "retry".
import { catalogueError } from '../catalogue'
defineProps<{ retry?: () => void }>()
</script>

<template>
  <p v-if="catalogueError" class="notice warn" role="alert">
    Game content didn't load: {{ catalogueError }}
    <button v-if="retry" type="button" class="small" @click="retry">Retry</button>
  </p>
</template>
