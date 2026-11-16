<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { since } from '../time'
import PilotCard from './PilotCard.vue'

// The GM queues (gm: pilots, gm: changes): a pilot card per item waiting for review, oldest first.
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
  <section class="panel" aria-labelledby="queue-title">
    <header class="panel-head">
      <h2 id="queue-title">Waiting for review <span class="badge">{{ items.length }}</span></h2>
      <p class="dim">{{ description }}</p>
    </header>
    <p v-if="!items.length" class="empty">Nothing waiting on a GM.</p>
    <ol v-else class="card-grid">
      <li v-for="item in items" :key="item.id">
        <PilotCard :to="item.to" :image="item.image" :callsign="item.callsign" :name="item.name" :player="item.player">
          <span class="dim">Waiting {{ since(item.submittedAt) }}</span>
        </PilotCard>
      </li>
    </ol>
  </section>
</template>
