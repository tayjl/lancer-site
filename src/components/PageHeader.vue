<script setup lang="ts">
// The top of a page, in the pilot sheet's style: the page's name large in lilac, a short line about it, and a
// rule under it. The default slot sits on the right (e.g. a count).
defineProps<{ title: string; summary?: string }>()
</script>

<template>
  <header class="page-header">
    <div>
      <h1>{{ title }}</h1>
      <p v-if="summary" class="dim">{{ summary }}</p>
    </div>
    <div class="side"><slot /></div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 2.5rem;
  margin-bottom: 1.75rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--rule);
}

h1 {
  margin: 0;
  font: 700 2rem/1.1 var(--mono);
}

p {
  margin: 0.35rem 0 0;
}

.side {
  margin-left: auto;
}

@media (max-width: 48rem) {
  .page-header {
    flex-direction: column;
    text-align: center;
  }

  h1 {
    font-size: 1.625rem;
  }

  .side {
    margin-left: 0;
  }
}
</style>
