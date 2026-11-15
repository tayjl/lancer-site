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
  <dialog ref="dialog" class="dialog confirm" aria-labelledby="confirm-message" @close="answerConfirm(false)" @click.self="answerConfirm(false)">
    <div v-if="shownConfirm" class="dialog-body">
      <p id="confirm-message">{{ shownConfirm.message }}</p>
      <div class="actions">
        <button ref="cancelButton" type="button" @click="answerConfirm(false)">cancel</button>
        <button ref="confirmButton" type="button" :class="shownConfirm.danger ? 'danger' : 'primary'" @click="answerConfirm(true)">
          {{ shownConfirm.confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* The frame is style.css's .dialog, narrower for a question. Its body fills it, so a click on the dialog itself
   is a click on the backdrop. */
.confirm {
  width: min(32rem, calc(100vw - 2rem));
}

p {
  margin: 0 0 1.25rem;
  white-space: pre-line;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
