import { customRef, nextTick } from 'vue'
import type { ModelRef } from 'vue'
import { describe, expect, it } from 'vitest'
import { latest, useFields } from './components/editor/useFields'

// A stand-in for defineModel under a parent's v-model: it shows a new value only after the parent has "re-rendered", a
// microtask later, which is what made two writes in one tick lose the first.
function parentModel<T>(start: T) {
  let prop = start
  const emitted: T[] = []
  const model = customRef<T>((track, trigger) => ({
    get: () => (track(), prop),
    set: (value) => { emitted.push(value); queueMicrotask(() => { prop = value; trigger() }) },
  })) as ModelRef<T>
  return { model, emitted, shown: () => prop }
}

describe('latest (the editor forms\' model)', () => {
  it('keeps every write made in one tick, through useFields', async () => {
    const { model, shown } = parentModel<Record<string, unknown>>({ name: 'x', source: '', license_id: '' })
    const f = useFields(latest(model))
    f.text('source').value = 'SSC'
    f.text('license_id').value = 'mf_marrow'
    f.list<string>('mechtype').value = ['Support']
    await nextTick()
    expect(shown()).toEqual({ name: 'x', source: 'SSC', license_id: 'mf_marrow', mechtype: ['Support'] })
  })
  it('lets a list change and then remove in one tick (RepeatList style)', async () => {
    const { model, shown } = parentModel([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
    const m = latest(model)
    m.value = m.value.map((item, i) => (i === 1 ? { ...item, name: 'B' } : item))
    m.value = m.value.filter((_, i) => i !== 0)
    expect(m.value).toEqual([{ name: 'B' }, { name: 'c' }])
    await nextTick()
    expect(shown()).toEqual([{ name: 'B' }, { name: 'c' }])
  })
  it("goes back to the parent's value once it has caught up", async () => {
    const { model } = parentModel({ a: 1 })
    const m = latest(model)
    m.value = { a: 2 }
    await nextTick()
    expect(m.value).toEqual({ a: 2 })
  })
})
