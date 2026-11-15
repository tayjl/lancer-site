<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

// The top of a page, in the pilot sheet's style: an optional breadcrumb ("registry / WARDEN / lantern ii"), the
// page's name large in lilac, a short line about it, and a rule under it. The default slot sits on the right
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
  gap: 1rem 2.5rem;
  margin-bottom: 1.75rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--rule);
  overflow-wrap: anywhere; /* a long unbroken callsign wraps instead of widening the page */
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

  .crumbs :deep(ol) {
    justify-content: center;
  }

  h1 {
    font-size: 1.625rem;
  }

  .side {
    margin-left: 0;
  }
}
</style>
