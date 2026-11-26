<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { profile, session } from '../auth'
import FileSection from '../components/FileSection.vue'
import Icon from '../components/Icon.vue'
import PageHeader from '../components/PageHeader.vue'
import { confirmAction } from '../confirm'
import { deleteAllImages } from '../images'
import { readError, supabase } from '../lib/supabaseClient'

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
    error.value = `Not deleted: ${readError(rpcError.message)}`
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

    <div class="policy">
      <FileSection id="stored" no="01" title="What we store" fixed>
        <dl class="manifest">
          <div>
            <dt class="label"><Icon name="user" />From your Discord login</dt>
            <dd><ul><li>Discord name</li><li>Discord user id</li><li>Email address</li><li>Avatar link</li></ul></dd>
          </div>
          <div>
            <dt class="label"><Icon name="pilot" />Added by you</dt>
            <dd><ul><li>Pilots</li><li>Images</li><li>Text</li></ul></dd>
          </div>
          <div>
            <dt class="label"><Icon name="map-pin" />Where it's kept</dt>
            <dd><ul><li>Supabase database and file storage</li><li>Hosted by Supabase</li><li>Site served by Cloudflare</li></ul></dd>
          </div>
        </dl>
      </FileSection>

      <FileSection id="access" no="02" title="Who can see it" fixed>
        <dl class="rows">
          <div><dt class="label">Everyone logged in</dt><dd>The public parts of approved pilots.</dd></div>
          <div><dt class="label">GMs</dt><dd>Everything about pilots.</dd></div>
          <div><dt class="label">GMs and owners only</dt><dd>Private parts like backstory, manna and reputation.</dd></div>
        </dl>
      </FileSection>

      <FileSection id="tracking" no="03" title="No ads and no tracking" fixed>
        <ul class="pledge">
          <li><Icon name="close" />No ads</li>
          <li><Icon name="close" />No analytics</li>
          <li><Icon name="close" />No tracking cookies</li>
        </ul>
        <p class="pledge-note dim">The only cookie-like data is your login.</p>
      </FileSection>

      <FileSection id="deleting" no="04" title="Keeping and deleting" fixed>
        <dl class="rows">
          <div><dt class="label">How long</dt><dd>Until you delete your account.</dd></div>
          <div><dt class="label">How to delete</dt><dd>{{ session ? 'Use the Delete account button below, or ask an owner on Discord.' : 'Ask an owner on Discord.' }}</dd></div>
          <div><dt class="label">What stays</dt><dd>Lore, notes and rewards you wrote about other pilots stay, without your name.</dd></div>
        </dl>
      </FileSection>

      <section v-if="session" class="panel danger-zone">
        <h2 class="sheet-label">Danger zone</h2>
        <div class="danger-body">
          <p class="dim">Deleting your account removes your pilots and their images. This can't be undone.</p>
          <button type="button" class="danger" :disabled="deleting" @click="deleteAccount">{{ deleting ? 'Deleting…' : 'Delete account' }}</button>
        </div>
        <p v-if="error" class="notice warn" role="alert">{{ error }}</p>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* The page's column: sections and the danger zone one under another, left-aligned. */
.policy {
  display: flex;
  flex-direction: column;
  gap: calc(var(--space-xl) + var(--space-l));
  max-width: 60rem;
}

/* What is stored, as cells on a hairline grid. Three across, stacked on phones. */
.manifest {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--rule);
}
.manifest > div { display: grid; align-content: start; gap: var(--space-s); padding: var(--space-m) var(--space-l) var(--space-l); background: var(--panel); }
.manifest dt { display: flex; align-items: center; gap: var(--space-s); }
.manifest dt .icon { font-size: 16px; }
.manifest dd { margin: 0; }
.manifest ul { display: grid; gap: var(--space-xs); margin: 0; padding: 0; list-style: none; }
.manifest li { position: relative; padding-left: var(--space-l); }
.manifest li::before { content: ''; position: absolute; top: 0.6em; left: 2px; width: 6px; height: 6px; background: var(--edge); }
@media (max-width: 48rem) { .manifest { grid-template-columns: minmax(0, 1fr); } }

/* A label and its answer per row. The label sits above the answer on phones. */
.rows { margin: 0; }
.rows > div {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  align-items: baseline;
  gap: var(--space-xs) var(--space-l);
  padding: var(--space-m) 0;
  border-top: 1px solid var(--rule);
}
.rows > div:last-child { border-bottom: 1px solid var(--rule); }
.rows dd { margin: 0; }
@media (max-width: 40rem) { .rows > div { grid-template-columns: minmax(0, 1fr); } }

/* The promise as three tiles, left-aligned like the rest of the page. */
.pledge {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--rule);
  list-style: none;
}
.pledge li { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-s); padding: var(--space-l) var(--space-m); background: var(--panel); font-weight: 700; text-align: left; }
.pledge .icon { font-size: 24px; color: var(--text-dim); }
.pledge-note { max-width: none; margin: var(--space-m) 0 0; font-size: var(--fs-s); text-align: left; }
@media (max-width: 40rem) {
  .pledge li { padding: var(--space-m) var(--space-s); font-size: var(--fs-s); }
  .pledge .icon { font-size: 20px; }
}
</style>
