<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { profile, session } from '../auth'
import PageHeader from '../components/PageHeader.vue'
import { confirmAction } from '../confirm'
import { deleteAllImages } from '../images'
import { supabase } from '../lib/supabaseClient'

const router = useRouter()
const deleting = ref(false)
const error = ref('')

async function deleteAccount() {
  const user = session.value?.user
  if (!user || deleting.value) return
  if (!(await confirmAction("Your account, your pilots and their images will be deleted. This can't be undone.", { confirmLabel: 'Delete account', danger: true }))) return
  deleting.value = true
  error.value = ''
  // GMs and owners upload onto other people's pilots, so only a player's own folder is theirs to clear.
  const imageError = profile.value?.role === 'player' ? await deleteAllImages(user.id) : null
  const { error: rpcError } = imageError ? { error: { message: imageError } } : await supabase.rpc('delete_my_account')
  if (rpcError) {
    error.value = `Not deleted: ${rpcError.message}`
    deleting.value = false
    return
  }
  // The login is gone already, so only this browser's copy is cleared.
  await supabase.auth.signOut({ scope: 'local' })
  await router.push({ name: 'login' })
}
</script>

<template>
  <main class="page">
    <PageHeader title="Privacy" summary="What this site keeps about you.">
      <RouterLink :to="{ name: 'home' }" class="link-button">Back</RouterLink>
    </PageHeader>

    <div class="prose">
      <h2>What we store</h2>
      <p>Your Discord name, Discord user id, email address and avatar link, as Discord gives them to the login. Also the pilots, images and text you add.</p>

      <h2>Who can see it</h2>
      <p>Everyone logged in sees the public parts of approved pilots. GMs see everything about pilots. Private parts like backstory, manna and reputation stay with the GMs and owners.</p>

      <h2>Where it's kept</h2>
      <p>In a Supabase database and file storage. Supabase hosts it. Cloudflare serves the site.</p>

      <h2>No ads and no tracking</h2>
      <p>There are no ads, no analytics and no tracking cookies. The only cookie-like data is your login.</p>

      <h2>How long</h2>
      <p>Until you delete your account.</p>

      <h2>Deleting your data</h2>
      <p>Use the Delete account button below, or ask an owner on Discord. Lore, notes and rewards you wrote about other pilots stay, without your name.</p>
    </div>

    <section v-if="session" class="panel danger-zone">
      <h2 class="sheet-label">Danger zone</h2>
      <div class="danger-body">
        <p class="dim">Deleting your account removes your pilots and their images. This can't be undone.</p>
        <button type="button" class="danger" :disabled="deleting" @click="deleteAccount">{{ deleting ? 'Deleting…' : 'Delete account' }}</button>
      </div>
      <p v-if="error" class="notice warn" role="alert">{{ error }}</p>
    </section>
  </main>
</template>

<style scoped>
.prose {
  max-width: 60ch;
  margin-bottom: var(--space-xl);
}

.prose h2 {
  margin: var(--space-l) 0 var(--space-xs);
  font-size: var(--fs-m);
}

.prose p {
  margin: 0;
}
</style>
