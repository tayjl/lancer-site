<script setup lang="ts">
// Shown under a page's header when a save found the row had been saved somewhere else (another tab, a GM). The page
// has stopped saving. Reloading shows the newer version; what was typed since is lost, as the text says.
const reload = () => window.location.reload()
</script>

<template>
  <div class="notice warn" role="alert">
    <div class="notice-head">
      <p class="notice-title">Not saved: this changed somewhere else</p>
      <button type="button" class="small" @click="reload">Reload</button>
    </div>
    <p>Another tab or a GM saved a newer version. Reload to see it; your last edit here wasn't saved.</p>
  </div>
</template>
