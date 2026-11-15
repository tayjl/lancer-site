import { shallowRef } from 'vue'

// "Are you sure?" in the site's own dialog (ConfirmDialog.vue, mounted once in App.vue) instead of the browser's
// window.confirm. Like the info dialog (src/info.ts): one shared request, null while nothing is asked.
export type ConfirmRequest = { message: string; confirmLabel: string; danger: boolean; resolve: (ok: boolean) => void }
export const shownConfirm = shallowRef<ConfirmRequest | null>(null)

// Resolves true if confirmed; false if cancelled, escaped, or replaced by another question.
export function confirmAction(message: string, options: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  shownConfirm.value?.resolve(false)
  return new Promise((resolve) => {
    shownConfirm.value = { message, confirmLabel: options.confirmLabel ?? 'confirm', danger: !!options.danger, resolve }
  })
}

// The dialog's answer. Answering twice (a button, then the dialog's close event) only counts the first.
export function answerConfirm(ok: boolean) {
  const request = shownConfirm.value
  shownConfirm.value = null
  request?.resolve(ok)
}
