<script setup lang="ts">
// The dashed [ + ] box that adds something to a section of the pilot page. "offline" is for sections
// that need LANCER data that isn't imported yet; "hint" explains why it can't be used yet otherwise.
defineProps<{ label: string; offline?: boolean; hint?: string }>()
</script>

<template>
  <button type="button" class="add-box" :disabled="offline || !!hint">
    <span class="plus" aria-hidden="true">+</span>
    <span>{{ label }}</span>
    <span v-if="offline" class="dim">module offline</span>
    <span v-else-if="hint" class="dim">{{ hint }}</span>
  </button>
</template>

<style scoped>
.add-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  width: 100%;
  min-height: 5rem;
  padding: 0.75rem;
  border: 1px dashed var(--rule);
  color: var(--lilac);
  font-size: 0.875rem;
  font-weight: 400;
}

/* No [ brackets ] or > arrows here: the box and the + already say "add". */
.add-box::before,
.add-box::after,
.add-box:hover::before,
.add-box:hover::after,
.add-box:focus::before,
.add-box:focus::after {
  content: none;
}

.add-box:hover:not(:disabled),
.add-box:focus-visible {
  border-color: var(--lilac);
  color: var(--lilac);
}

.add-box:focus-visible {
  outline: 1px solid var(--lilac);
  outline-offset: 2px;
}

.add-box:disabled {
  color: var(--text-dim);
  cursor: default;
}

.plus {
  font-size: 1.5rem;
  line-height: 1;
}
</style>
