<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { loginError } from '../auth'
import BootSequence from '../components/BootSequence.vue'
import { supabase } from '../lib/supabaseClient'

const error = ref(loginError)
const booted = ref(false)
const uplinkButton = useTemplateRef('uplinkButton')

async function onBooted() {
  booted.value = true
  await nextTick()
  // Ready for Enter straight away.
  uplinkButton.value?.focus()
}

async function uplink() {
  // Supabase sends the browser to Discord, then back to this site already logged in.
  const { error: signInError } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: window.location.origin },
  })
  if (signInError) error.value = signInError.message
}
</script>

<template>
  <main class="login">
    <h1 class="sr-only">HOR_OS</h1>
    <BootSequence @done="onBooted" />

    <div class="uplink">
      <!-- Hidden (but still taking up its space) until the log finishes, so nothing jumps when it appears. -->
      <button ref="uplinkButton" type="button" :class="{ waiting: !booted }" @click="uplink">uplink with discord</button>
      <p v-if="error" role="alert" class="error">Uplink failed: {{ error }}</p>
    </div>
  </main>
</template>

<style scoped>
/* A full-screen terminal: the art pinned at the top, the log in the middle and the Uplink button
   pinned at the bottom. The art sizes itself to this column's width (via the container).
   On shorter screens the art has to shrink to leave room for the log (100dvh - 20rem is the height
   it may use, and 1.514 is the art's width-to-height ratio), so the column narrows with it to keep
   the text and art lined up, but never below 34rem. 47rem matches the art at its 16px maximum. */
.login {
  container-type: inline-size;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(100% - 2rem, 47rem, max(34rem, (100dvh - 20rem) * 1.514));
  height: 100vh;
  height: 100dvh; /* the visible height on phones, allowing for the browser's toolbars */
  margin: 0 auto;
}

.uplink {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 0 1.5rem;
  text-align: center;
}

.uplink button {
  font-size: 1.0625rem;
}

.waiting {
  visibility: hidden;
}

.error {
  margin: 0;
  color: var(--rose);
}

/* Too short to pin anything (e.g. a phone held sideways): the page just scrolls normally. */
@media (max-height: 30rem) {
  .login {
    display: block;
    height: auto;
  }
}
</style>
