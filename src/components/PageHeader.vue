<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

// The top of a page, in the pilot sheet's style: an optional breadcrumb ("Registry / WARDEN / Lantern II"), the
// page's name large, a short line about it, and a rule under it. The default slot sits on the right
// (e.g. a count). The last crumb is the current page, so it isn't a link.
defineProps<{ title: string; summary?: string; crumbs?: { label: string; to?: RouteLocationRaw }[] }>()
</script>

<template>
  <header class="page-header">
    <div>
      <nav v-if="crumbs?.length" aria-label="Breadcrumb" class="crumbs">
        <ol>
          <li v-for="(crumb, i) in crumbs" :key="i">
            <span v-if="i === crumbs.length - 1" aria-current="page">{{ crumb.label }}</span>
            <RouterLink v-else-if="crumb.to" :to="crumb.to">{{ crumb.label }}</RouterLink>
            <span v-else>{{ crumb.label }}</span>
          </li>
        </ol>
      </nav>
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
  gap: var(--space-l) var(--space-xl);
  margin-bottom: var(--space-xl);
  padding-bottom: var(--space-l);
  border-bottom: 1px solid var(--rule);
  overflow-wrap: anywhere; /* a long unbroken callsign wraps instead of widening the page */
}

h1 {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: 800;
  line-height: 1.1;
}

p {
  margin: var(--space-xs) 0 0;
}

.side {
  margin-left: auto;
}

/* Phones: a short side (a count) stays beside the title and a wide one (buttons) wraps under it, with a tighter gap and rule. */
@media (max-width: 48rem) {
  .page-header {
    align-items: flex-start;
    gap: var(--space-s) var(--space-m);
    margin-bottom: var(--space-l);
    padding-bottom: var(--space-m);
  }

  h1 {
    font-size: 22px;
  }
}
</style>
