<script setup lang="ts">
import type { PendingChange } from '../myPilot'

// A GM's edit mode on someone else's pilot (pilot sheet and mech pages, ?edit=1): a bar joined to the header's foot,
// like the "what happens next" bar, saying saves skip approval, with the save status and a Done button. If the
// player has a change open, a warning under it: a direct edit blocks that change from being approved
// (approve_change refuses a pilot that changed since the change was made).
defineProps<{ name: string; waiting: PendingChange | null; status: string; error: string; canRetry: boolean }>()
defineEmits<{ done: []; retry: [] }>()
</script>

<template>
  <div class="gm-edit">
    <div class="bar">
      <span class="badge">GM edit</span>
      <p>Changes save straight to this pilot, without approval.</p>
      <p class="save-status" role="status">
        <template v-if="error">
          <span class="error">Not saved: {{ error }}</span>
          <button v-if="canRetry" type="button" class="small quiet" @click="$emit('retry')">Retry</button>
        </template>
        <span v-else class="dim">{{ status }}</span>
      </p>
      <button type="button" class="small done" @click="$emit('done')">Done</button>
    </div>
    <p v-if="waiting" class="notice warn" role="note">
      {{ name }} has a change waiting for review. Editing directly will stop it from being approved: review it first.
      <RouterLink v-if="waiting.submitted_at" :to="{ name: 'gm-change', params: { id: waiting.id } }">Open the change</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.gm-edit {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
  margin-top: calc(-1 * var(--space-m)); /* joined to the header: cancels the sheet's gap */
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
  padding: var(--space-s) var(--space-l);
  border: 1px solid var(--rule);
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
  background: var(--void);
  font-size: var(--fs-s);
}

p {
  max-width: none;
  margin: 0;
}

.error {
  color: var(--danger);
}

.done {
  margin-left: auto;
}

@media (max-width: 48rem) {
  .bar {
    padding: var(--space-s) var(--space-m);
  }

  .bar > p:first-of-type {
    flex-basis: 100%;
  }

  .done {
    flex: 1 0 100%;
    margin-left: 0;
  }
}
</style>
