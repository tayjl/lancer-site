import { onBeforeUnmount, ref } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'

// "Copy link": puts a page's full address on the clipboard, then "copied" says Copied or Not copied for 2 seconds
// (shown in place of the button's label, inside an aria-live spot). Shared by lore entries, ID cards and the mech page.
export function useCopyLink() {
  const router = useRouter()
  const copied = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  async function copyLink(to: RouteLocationRaw) {
    try {
      await navigator.clipboard.writeText(new URL(router.resolve(to).href, window.location.origin).href)
      copied.value = 'Copied'
    } catch {
      copied.value = 'Not copied'
    }
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = ''), 2000)
  }
  onBeforeUnmount(() => clearTimeout(timer))
  return { copied, copyLink }
}
