<script setup lang="ts">
import type { ChangeRow } from '../myPilot'
import SaveStatus from './SaveStatus.vue'

// A GM's edit mode on someone else's pilot (pilot sheet and mech pages, ?edit=1): a bar joined to the header's foot,
// like the "what happens next" bar, saying saves skip approval and rules are off, with an optional slot (the rewards row) under it, with the save status and a Done button. If the
// player has a change open, a warning under it: a direct edit blocks that change from being approved
// (approve_change refuses a pilot that changed since the change was made).
defineProps<{ name: string; waiting: ChangeRow | null; saving: boolean; saved: boolean; error: string; canRetry: boolean }>()
defineEmits<{ done: []; retry: [] }>()
</script>

<template>
  <div class="gm-edit">
    <div class="bar">
      <span class="badge gm">GM edit</span>
      <p>Saves go straight to this pilot. Rules and prices are off.</p>
      <SaveStatus :saving="saving" :saved="saved" :error="error" :can-retry="canRetry" @retry="$emit('retry')" />
      <button type="button" class="small done" @click="$emit('done')">Done</button>
      <div v-if="$slots.default" class="extra"><slot /></div>
    </div>
    <p v-if="waiting" class="notice warn" role="note">
      {{ name }} has a change waiting. Editing blocks its approval.
      <RouterLink v-if="waiting.submitted_at" :to="{ name: 'gm-change', params: { id: waiting.id } }">Open change</RouterLink>
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

.extra {
  flex-basis: 100%;
  border-top: 1px solid var(--rule);
  padding-top: var(--space-s);
  margin-top: var(--space-xs);
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
    min-height: var(--tap);
    flex: 1 0 auto;
    margin-left: 0;
    white-space: nowrap;
  }
}
</style>
