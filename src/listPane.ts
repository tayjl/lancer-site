import { onUnmounted, ref, watch, type Ref, type ShallowRef } from 'vue'

// What the archives and the lore page share: a list beside a detail pane. Over 56rem (as the CSS) the chosen entry
// shows in the pane; "wide" says which. "pane" and "listBox" are the page's template refs for the pane and the list.
// "active" says whether the pane is showing (the lore page's is "wide"; the archives' also needs a category).
type TemplateRef = Readonly<ShallowRef<HTMLElement | null>>
export function useListPane({ selected, listed, pane, listBox, active }: {
  selected: Ref<unknown>
  listed: Ref<unknown>
  pane: TemplateRef
  listBox: TemplateRef
  active: () => boolean
}) {
  const wideQuery = window.matchMedia('not all and (max-width: 56rem)')
  const wide = ref(wideQuery.matches)
  const onWide = (event: MediaQueryListEvent) => (wide.value = event.matches)
  wideQuery.addEventListener('change', onWide)
  onUnmounted(() => wideQuery.removeEventListener('change', onWide))

  // A new entry in the pane starts at its top, and its row is brought into the list's view (a linked one may be far
  // down), again when the list changes around it. Only the list scrolls, never the page.
  watch(selected, () => pane.value?.scrollTo({ top: 0 }), { flush: 'post' })
  watch([selected, listed], () => {
    const list = listBox.value
    const row = list?.querySelector<HTMLElement>('.row[aria-current="true"]')
    if (!list || !row || !active()) return
    // What of the list is on screen: before the page scrolls and it sticks, its foot can be below the window's.
    const box = list.getBoundingClientRect()
    const seen = Math.min(box.bottom, window.innerHeight) - box.top
    const top = row.getBoundingClientRect().top - box.top + list.scrollTop
    if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + seen) list.scrollTop = top - seen / 3
  }, { flush: 'post' })

  // Arrow keys move through the list (on desktop choosing as they go); Tab and Enter work as for any button or link.
  function step(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const rows = [...(listBox.value?.querySelectorAll<HTMLElement>('.row') ?? [])]
    const current = document.activeElement as HTMLElement
    const next = rows[rows.indexOf(current) + (event.key === 'ArrowDown' ? 1 : -1)]
    if (!rows.includes(current) || !next) return
    event.preventDefault()
    next.focus()
    if (active()) next.click()
  }

  return { wide, step }
}
