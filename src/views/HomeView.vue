<script setup lang="ts">
import { useRouter } from 'vue-router'
import { profile } from '../auth'
import { supabase } from '../lib/supabaseClient'

const router = useRouter()

async function logOut() {
  await supabase.auth.signOut()
  await router.push({ name: 'login' })
}
</script>

<template>
  <main>
    <h1>LANCER Campaign</h1>
    <p v-if="profile">Logged in as {{ profile.display_name }} ({{ profile.role }})</p>
    <button type="button" @click="logOut">Log out</button>
  </main>
</template>
