<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { PickOption } from '../pickerRows'
import PickList from './PickList.vue'

// A picker dialog for one loadout slot (or the frame, a licence...): a searchable list of options (PickList.vue: boxes per
// manufacturer, rows of symbols and numbers, the long text only in each option's full information) with a button to
// choose each. "blocked" on an option disables the button, keeping its label, and says why beside it (e.g. "Not enough
// system points"). The parent opens it with open(), saves the choice itself, then closes it with close(). Search
// looks through the name, the facts, the group and the option's hidden "search" text (the rules).
const props = defineProps<{ title: string; options: PickOption[]; current?: string | null; saving?: boolean; error?: string; empty?: string }>()
const emit = defineEmits<{ choose: [id: string] }>()

const dialog = useTemplateRef('dialog')
const filter = ref('')

const shown = computed(() => {
  const words = filter.value.trim().toLowerCase()
  const haystack = (option: PickOption) => [option.name, [option.meta ?? ''].flat().join(' '), option.text, option.search, option.group?.title, option.group?.name, ...(option.chips ?? []).map((chip) => chip.label), ...(option.stats ?? []).map((stat) => stat.label)].join(' ').toLowerCase()
  return props.options.filter((option) => words.split(/\s+/).every((word) => haystack(option).includes(word)))
})

function open() {
  filter.value = ''
  dialog.value?.showModal()
}

defineExpose({ open, close: () => dialog.value?.close() })
</script>

<template>
  <dialog ref="dialog" class="dialog" :aria-label="title">
    <header class="dialog-head">
      <h2>{{ title }}</h2>
      <button type="button" class="small" @click="dialog?.close()">Close</button>
    </header>
    <div class="dialog-bar">
      <label class="field">
        <span>Search</span>
        <input v-model="filter" type="search" autofocus />
      </label>
      <p class="dim count" aria-live="polite"><span class="num">{{ shown.length }}</span> of <span class="num">{{ options.length }}</span></p>
      <p v-if="error" class="notice warn" role="alert">Not saved: {{ error }}</p>
    </div>

    <div class="dialog-body">
      <PickList v-if="shown.length" :options="shown" :current="current">
        <template #action="{ option }">
          <button v-if="option.id === current" type="button" class="small" disabled>Chosen</button>
          <template v-else>
            <button
              type="button"
              class="small"
              :disabled="saving || !!option.blocked"
              :aria-describedby="option.blocked ? `why-${option.id}` : undefined"
              @click="emit('choose', String(option.id))"
            >
              Choose
            </button>
            <span v-if="option.blocked" :id="`why-${option.id}`" class="pick-reason">{{ option.blocked }}</span>
          </template>
        </template>
      </PickList>
      <p v-else class="empty">{{ filter ? 'Nothing matches that search.' : empty ?? 'No options.' }}</p>
    </div>
  </dialog>
</template>
