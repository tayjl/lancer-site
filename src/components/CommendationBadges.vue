<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import type { Award } from '../commendations'
import { formatDate } from '../time'
import MedalBadge from './MedalBadge.vue'

// A row of the pilot's medals, each opening a small dialog with its description, the reason, who awarded it and when.
// Shows nothing when there are none.
defineProps<{ awards: Award[] }>()

const dialog = useTemplateRef('dialog')
const chosen = ref<Award | null>(null)

function show(award: Award) {
  chosen.value = award
  dialog.value?.showModal()
}
</script>

<template>
  <section v-if="awards.length" class="medals" aria-label="Commendations">
    <h2 class="sr-only">Commendations</h2>
    <ul>
      <li v-for="award in awards" :key="award.id">
        <button type="button" class="medal-button" :aria-label="`${award.commendation.name}: details`" @click="show(award)">
          <MedalBadge :icon="award.commendation.icon" :name="award.commendation.name" />
        </button>
      </li>
    </ul>
  </section>

  <!-- A click on the dialog itself is a click on the backdrop (its parts fill it). -->
  <dialog ref="dialog" class="dialog medal-dialog" :aria-label="chosen?.commendation.name ?? 'Commendation'" @click.self="dialog?.close()">
    <template v-if="chosen">
      <header class="dialog-head">
        <h2>{{ chosen.commendation.name }}</h2>
        <button type="button" class="small" autofocus @click="dialog?.close()">Close</button>
      </header>
      <div class="dialog-body">
        <p v-if="chosen.commendation.description" class="prose">{{ chosen.commendation.description }}</p>
        <dl class="kv">
          <dt>Reason</dt>
          <dd>{{ chosen.reason || 'No reason given.' }}</dd>
          <dt>Awarded by</dt>
          <dd>{{ chosen.by ?? 'A GM' }}</dd>
          <dt>Date</dt>
          <dd>{{ formatDate(chosen.awarded_at) }}</dd>
        </dl>
      </div>
    </template>
  </dialog>
</template>

<style scoped>
.medals {
  display: contents; /* the medals sit in the cover's own row */
}

ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s) var(--space-m);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* The medal is a button (it opens a dialog), so it gets the site's hover and focus ring, not the pilot's colour. */
.medal-button {
  min-height: var(--tap);
  padding: 2px var(--space-m) 2px 2px;
  border: 1px solid var(--rule);
  border-radius: 999px;
  background: var(--void);
  letter-spacing: 0;
  text-transform: none;
}

.medal-dialog {
  width: min(28rem, calc(100vw - 2rem));
  --mf: var(--pilot, var(--edge));
}

.medal-dialog p {
  margin: 0 0 var(--space-m);
}

.kv {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: var(--space-xs) var(--space-l);
  margin: 0;
}

.kv dt {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.kv dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
