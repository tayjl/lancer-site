import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import { confirmAction } from '../../confirm'
import { errorsOf, type Problem } from '../../contentEditor'
import type { Loaded, Saved } from '../../editorStore'
import { CHANGED_ELSEWHERE } from '../../lib/supabaseClient'
import { useSaveStatus } from '../../saveStatus'

// The shared workings of a site table's small editor (FactionPane.vue, CommendationPane.vue): a form saved explicitly,
// guarded by updated_at like the other site tables, with a delete. "item" is null for a new one.
type Store<T> = {
  create: (fields: T) => Promise<Saved & { key?: string }>
  save: (item: Loaded, fields: T) => Promise<Saved>
  remove: (key: string) => Promise<string | null>
  confirm: (name: string) => { message: string; label: string }
}
type Emit = ((event: 'created', key: string) => void) & ((event: 'changed') => void) & ((event: 'deleted') => void)

export function useSimpleEditor<T extends { name: string }>(item: Loaded | null, initial: T, validate: (fields: T) => Problem[], store: Store<T>, emit: Emit) {
  const isNew = item === null
  const form = ref({ ...initial }) as Ref<T>
  const baseline = ref({ ...initial }) as Ref<T>
  const updatedAt = ref(item?.updatedAt ?? '')
  const dirty = computed(() => (Object.keys(form.value) as (keyof T)[]).some((key) => form.value[key] !== baseline.value[key]))
  // Once created, the list already holds this entry's own name until the page switches to it: don't check against it.
  const created = ref(false)
  const problems = computed(() => (created.value ? [] : validate(form.value)))
  const status = useSaveStatus()
  const conflict = ref(false)
  const busy = computed(() => status.saving.value)

  async function save() {
    if (errorsOf(problems.value).length || busy.value || conflict.value || (!isNew && !dirty.value)) return
    const snapshot = { ...form.value, name: form.value.name.trim() }
    const failed = await status.track((async () => {
      const made = isNew ? await store.create(snapshot) : null
      const result = made ?? await store.save({ ...item!, updatedAt: updatedAt.value }, snapshot)
      if (result.error !== undefined) return result.error
      baseline.value = { ...snapshot }
      form.value = { ...snapshot }
      if (made?.key) {
        created.value = true
        emit('created', made.key)
      }
      else {
        updatedAt.value = result.updatedAt
        emit('changed')
      }
      return null
    })())
    if (failed === CHANGED_ELSEWHERE) conflict.value = true
  }

  const deleteError = ref('')
  async function remove() {
    const { message, label } = store.confirm(baseline.value.name)
    if (!(await confirmAction(message, { confirmLabel: label, danger: true }))) return
    deleteError.value = (await store.remove(item!.key)) ?? ''
    if (!deleteError.value) {
      baseline.value = { ...form.value }
      emit('deleted')
    }
  }

  const warnLeaving = (event: BeforeUnloadEvent) => { if (dirty.value) event.preventDefault() }
  onMounted(() => window.addEventListener('beforeunload', warnLeaving))
  onUnmounted(() => window.removeEventListener('beforeunload', warnLeaving))

  return { isNew, form, baseline, dirty, problems, status, conflict, busy, save, deleteError, remove }
}
