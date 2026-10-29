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
  <section class="review-queue">
    <header>
      <div><h2>waiting for review</h2><p class="dim">{{ description }}</p></div>
      <span class="dim">{{ items.length }} waiting</span>
    </header>
    <p v-if="!items.length" class="empty dim">nothing waiting on a gm.</p>
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
header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
h2 { margin: 0; font-size: clamp(1.5rem, 2.5vw, 2rem); }
header p { margin: 0.5rem 0 0; }
.empty { max-width: none; margin: 0; padding: 2.5rem 1.5rem; border: 1px dashed var(--rule); text-align: center; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); gap: 1rem; margin: 0; padding: 0; list-style: none; }
.card { display: flex; align-items: center; gap: 1.25rem; height: 100%; padding: 1.25rem; border: 1px solid var(--rule); color: var(--text); text-decoration: none; }
.card:hover { border-color: var(--lilac); background: var(--panel); }
.card :deep(.portrait) { flex: 0 0 5rem; }
.card > div { min-width: 0; overflow-wrap: anywhere; }
.card h3 { margin: 0 0 0.5rem; font-size: 1.25rem; }
.card p { margin: 0.2rem 0; }
.age { color: var(--sky); }
</style>
