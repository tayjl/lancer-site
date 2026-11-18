<script setup lang="ts">
// The save status line: "Saving…", "Saved", or "Not saved: …" with a Retry (unless the page needs a reload instead).
// Styled by the global .save-status .error (src/style.css); the page places it.
defineProps<{ saving: boolean; saved: boolean; error: string; canRetry: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <p class="save-status" role="status">
    <template v-if="error">
      <span class="error">Not saved: {{ error }}</span>
      <button v-if="canRetry" type="button" class="small quiet" @click="$emit('retry')">Retry</button>
    </template>
    <span v-else-if="saving" class="dim">Saving…</span>
    <span v-else-if="saved" class="dim">Saved</span>
  </p>
</template>
