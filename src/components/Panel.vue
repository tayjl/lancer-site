<script setup lang="ts">
// A terminal "window": a shaded title bar (with optional actions on the right) above a bordered body.
// "tag" adds a small label after the title, e.g. [private].
defineProps<{ title: string; tag?: string }>()
</script>

<template>
  <section class="panel">
    <header class="panel-head">
      <h2>
        <span class="marker" aria-hidden="true">▍</span>{{ title }}
        <span v-if="tag" class="tag">[{{ tag }}]</span>
      </h2>
      <div class="panel-actions"><slot name="actions" /></div>
    </header>
    <div class="panel-body"><slot /></div>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid var(--rule);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.45rem 0.9rem;
  border-bottom: 1px solid var(--rule);
  background: var(--panel);
}

.panel-head h2 {
  margin: 0;
  color: var(--text);
  font-size: 0.8125rem;
  font-weight: 600;
}

.marker {
  margin-right: 0.4rem;
  color: var(--lilac);
}

.tag {
  margin-left: 0.25rem;
  color: var(--rose);
  font-weight: 400;
}

.panel-actions {
  display: flex;
  gap: 1rem;
}

.panel-actions :deep(button) {
  padding: 0;
  font-size: 0.8125rem;
}

.panel-body {
  padding: 1rem 0.9rem;
}
</style>
