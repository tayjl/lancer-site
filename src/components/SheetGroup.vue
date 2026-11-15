<script setup lang="ts">
// A sheet section under one large, centred title (my pilot's mech hangar), with room for buttons ("tools") beside it.
// The other groups are tabs (SheetTabs.vue).
defineProps<{ title: string }>()
</script>

<template>
  <section class="group">
    <header class="group-head">
      <h2 class="group-title">{{ title }}</h2>
      <span class="tools"><slot name="tools" /></span>
    </header>
    <div class="group-body"><slot /></div>
  </section>
</template>

<style scoped>
.group-head {
  position: relative;
  display: flex;
  justify-content: center;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--rule);
}

.group-title {
  margin: 0;
  color: var(--lilac);
  font-size: 1.5rem;
}

.tools {
  position: absolute;
  right: 0;
  bottom: 0.6rem;
}

.tools :slotted(button) {
  min-height: 2rem;
  padding: 0.3rem 0.65rem;
  font-size: 0.875rem;
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  margin-top: 1.25rem;
}
</style>
