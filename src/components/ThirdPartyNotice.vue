<script setup lang="ts">
// The acknowledgement Massif Press's Lancer Third Party License requires (https://massifpress.com/legal).
// Keep the wording as it is; only the site's name may change.
const NAME = 'HOR_OS'
</script>

<template>
  <p class="notice">
    {{ NAME }} is not an official Lancer product or service; it is a third party work, and is not affiliated with Massif Press.
    {{ NAME }} is published via the
    <a href="https://massifpress.com/legal" target="_blank" rel="noopener">Lancer Third Party License</a>. Lancer is
    copyright Massif Press.
  </p>
</template>

<style scoped>
.notice {
  max-width: 60ch;
  margin: 0;
  color: var(--text-dim);
  font: 400 0.6875rem/1.5 var(--mono);
}

.notice a {
  color: inherit;
}

.notice a:hover {
  color: var(--lilac);
}
</style>
