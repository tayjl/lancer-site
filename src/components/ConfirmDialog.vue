<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import { answerConfirm, shownConfirm } from '../confirm'

// The site's "are you sure?" (src/confirm.ts). A native modal dialog, so focus stays inside and Escape cancels.
// Opened after any other dialog, so it sits on top of it. Destructive questions start on cancel.
const dialog = useTemplateRef('dialog')
const cancelButton = useTemplateRef('cancelButton')
const confirmButton = useTemplateRef('confirmButton')

watch(shownConfirm, async (request) => {
  if (!request) return dialog.value?.close()
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
  ;(request.danger ? cancelButton : confirmButton).value?.focus()
})
</script>

<template>
  <!-- Escape, cancel and a click on the backdrop all close it, which answers "no" unless already answered. -->
  <dialog ref="dialog" class="dialog confirm" aria-labelledby="confirm-title" aria-describedby="confirm-message" @close="answerConfirm(false)" @click.self="answerConfirm(false)">
    <template v-if="shownConfirm">
      <header class="dialog-head"><h2 id="confirm-title">Are you sure?</h2></header>
      <p id="confirm-message" class="dialog-body">{{ shownConfirm.message }}</p>
      <footer class="foot">
        <button ref="cancelButton" type="button" class="quiet" @click="answerConfirm(false)">Cancel</button>
        <button ref="confirmButton" type="button" :class="shownConfirm.danger ? 'danger' : 'primary'" @click="answerConfirm(true)">
          {{ shownConfirm.confirmLabel }}
        </button>
      </footer>
    </template>
  </dialog>
</template>

<style scoped>
/* The frame is style.css's .dialog, narrower for a question. Its parts fill it, so a click on the dialog itself is a
   click on the backdrop. */
.confirm {
  width: min(32rem, calc(100vw - 2rem));
}

.dialog-body {
  max-width: none;
  margin: 0;
  white-space: pre-line;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-s);
  padding: var(--space-m) var(--space-l);
  border-top: 1px solid var(--rule);
}

@media (max-width: 40rem) {
  .foot {
    padding-inline: var(--space-m);
  }
}
</style>
