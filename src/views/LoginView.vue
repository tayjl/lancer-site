<script setup lang="ts">
import { ref } from 'vue'
import { loginError } from '../auth'
import { supabase } from '../lib/supabaseClient'

const error = ref(loginError)

async function logIn() {
  // Supabase sends the browser to Discord, then back to this site already logged in.
  const { error: signInError } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: window.location.origin },
  })
  if (signInError) error.value = signInError.message
}
</script>

<template>
  <main>
    <h1>LANCER Campaign</h1>
    <button type="button" @click="logIn">Log in with Discord</button>
    <p v-if="error" role="alert">Login failed: {{ error }}</p>
  </main>
</template>
