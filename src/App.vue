<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { profile } from './auth'
import { supabase } from './lib/supabaseClient'

const route = useRoute()
const router = useRouter()

async function disconnect() {
  await supabase.auth.signOut()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header v-if="!route.meta.public" class="bar">
    <RouterLink to="/" class="brand">HOR_OS</RouterLink>
    <div class="operator">
      <span v-if="profile">
        {{ profile.display_name }} <span class="clearance">{{ profile.role }} clearance</span>
      </span>
      <button type="button" class="quiet" @click="disconnect">Disconnect</button>
    </div>
  </header>
  <RouterView />
</template>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  /* Lines the header up with the .page column on wide screens. */
  padding: 0.75rem max(1.5rem, (100% - 72rem) / 2 + 1.5rem);
  border-bottom: 1px solid var(--rule);
  font: 400 0.875rem/1.4 var(--mono);
}

.brand {
  color: var(--lilac);
  font-size: 1.125rem;
  font-weight: 700;
  text-decoration: none;
}

.operator {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.clearance {
  color: var(--text-dim);
}

@media (max-width: 40rem) {
  .bar {
    padding: 0.75rem 1rem;
  }
}
</style>
