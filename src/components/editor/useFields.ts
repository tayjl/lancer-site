import { computed, customRef, inject, nextTick, provide, ref, type InjectionKey, type ModelRef, type Ref } from 'vue'
import type { Data, Problem } from '../../contentEditor'
import { useMechData } from '../../mechData'

// Small helpers the forms share: an input's value, an array field's value (or [] if it isn't one), and an empty
// array left out of the data.
export const input = (event: Event) => (event.target as HTMLInputElement | HTMLSelectElement).value
export const list = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : [])
export const clean = <T,>(value: T[]) => (value.length ? value : undefined)
// A folded text section's summary: the labels of the fields with something in them (rules text is HTML, so tags don't count).
export const filled = (fields: [string, unknown][]) =>
  fields.filter(([, value]) => String(value ?? '').replace(/<[^>]*>/g, '').trim()).map(([label]) => label).join(', ') || 'Empty'

// A form's v-model, where a write is seen by the very next read. A plain defineModel only shows the parent's new value
// after the parent re-renders, so two writes in one tick (each spreading the object it just read) would lose the first;
// this keeps the last write until the parent has caught up. Every editor component wraps its model in it.
export function latest<T>(model: ModelRef<T>): Ref<T> {
  let pending: { value: T } | undefined
  return customRef((track, trigger) => ({
    get() {
      track()
      return pending ? pending.value : model.value
    },
    set(value: T) {
      pending = { value }
      model.value = value
      trigger()
      nextTick(() => { pending = undefined; trigger() })
    },
  }))
}

// What the editor's forms edit: one item's data as a plain object, replaced whole on every change (so the editor can
// tell what changed). "field" gives each key as a writable value, typed by what the form shows.
export function useFields(model: Ref<Data>) {
  const set = (key: string, value: unknown) => (model.value = { ...model.value, [key]: value })
  return {
    text: (key: string) => computed({ get: () => String(model.value[key] ?? ''), set: (value: string) => set(key, value) }),
    // A number box's v-model already hands over a number (or "" when it's empty).
    number: (key: string) => computed({ get: () => String(model.value[key] ?? ''), set: (value: string | number) => set(key, value === '' ? '' : Number(value)) }),
    flag: (key: string) => computed({ get: () => model.value[key] === true, set: (value: boolean) => set(key, value) }),
    list: <T>(key: string) => computed({ get: () => (Array.isArray(model.value[key]) ? (model.value[key] as T[]) : []), set: (value: T[]) => set(key, value) }),
  }
}

// What the form shows about the item's problems (src/contentEditor.ts): each one names the input it belongs to as a path
// ("profiles.1.name"). The editor provides the list; Field and the list fields ask for what's at their path, so the
// form marks the input and says what's wrong under it. Outside an editor there's nothing to show.
const PROBLEMS: InjectionKey<Ref<Problem[]>> = Symbol('editor problems')
export const provideProblems = (problems: Ref<Problem[]>) => provide(PROBLEMS, problems)
export function useProblems() {
  const problems = inject(PROBLEMS, ref<Problem[]>([]))
  return {
    // What's wrong at this path, and (with "deep") anywhere below it.
    at: (path: string, deep = false) => problems.value.filter((problem) => problem.field !== undefined && (problem.field === path || (deep && problem.field.startsWith(`${path}.`)))),
    // An error here: the input gets the danger outline and aria-invalid.
    invalid: (path: string) => problems.value.some((problem) => problem.level === 'error' && problem.field === path),
  }
}

// Every weapon and system, even the built-in and talent-only ones, as ItemIdListField's choices (what a talent rank or a
// frame's core system grants).
export function useEquipmentOptions() {
  const { weapons, systems, integrated } = useMechData()
  return computed(() => {
    const seen = new Set<string>()
    return [...weapons.value, ...systems.value, ...integrated.value.values()]
      .filter((item) => !seen.has(item.id) && seen.add(item.id))
      .map((item) => ({ id: item.id, name: item.name, meta: [item.mount, item.type].filter(Boolean).join(' ') }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })
}
