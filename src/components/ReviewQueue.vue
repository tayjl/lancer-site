<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { since } from '../time'
import Portrait from './Portrait.vue'

defineProps<{
  description: string
  items: {
    id: number
    callsign: string | null
    name: string
    image: string | null
    player: string
    submittedAt: string
    to: RouteLocationRaw
  }[]
}>()
</script>

<template>
  <section class="review-queue panel" aria-labelledby="queue-title">
    <header class="panel-head">
      <h2 id="queue-title">waiting for review <span class="badge count" :class="{ pending: items.length }">{{ items.length }} waiting</span></h2>
      <p class="dim">{{ description }}</p>
    </header>
    <p v-if="!items.length" class="empty">nothing waiting on a gm.</p>
    <ol v-else class="cards">
      <li v-for="item in items" :key="item.id">
        <RouterLink :to="item.to" class="card">
          <Portrait :src="item.image" :alt="`Portrait of ${item.callsign || item.name}`" />
          <div>
            <h3>{{ item.callsign || item.name }}</h3>
            <p>{{ item.name }}</p>
            <p class="rose">{{ item.player }}</p>
            <p class="age">waiting {{ since(item.submittedAt) }}</p>
          </div>
        </RouterLink>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 24rem)); justify-content: center; gap: var(--space-m); margin: 0; padding: 0; list-style: none; }
.card { display: flex; align-items: center; gap: 1.25rem; height: 100%; padding: 1rem; border: 1px solid var(--rule); background: var(--void); color: var(--text); text-decoration: none; }
.card:hover, .card:focus-visible { border-color: var(--lilac); background: var(--raised); color: var(--text); }
.card :deep(.portrait) { flex: 0 0 5rem; }
.card > div { min-width: 0; overflow-wrap: anywhere; }
.card h3 { margin: 0 0 0.35rem; font-size: 1.125rem; }
.card p { margin: 0.15rem 0; }
.age { color: var(--sky); font-size: 0.875rem; }
</style>
