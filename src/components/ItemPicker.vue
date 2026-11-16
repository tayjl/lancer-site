<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { Info } from '../info'
import InfoButton from './InfoButton.vue'

// A picker dialog for one loadout slot (or the frame): a searchable list of options, each with its name, its facts
// ("meta", a string or a list shown dot-separated), a short summary and a button to choose it. "blocked" on an option
// disables the button, keeping its label, and says why beside it (e.g. "Not enough SP"). The parent opens it with
// open(), saves the choice itself, then closes it with close(). With "info", an option's name opens its full
// information on top of the picker.
type Option = { id: string; name: string; meta?: string | string[]; text?: string; blocked?: string; info?: () => Info }
const props = defineProps<{ title: string; options: Option[]; current?: string | null; saving?: boolean; error?: string; empty?: string }>()
const emit = defineEmits<{ choose: [id: string] }>()

const dialog = useTemplateRef('dialog')
const filter = ref('')

const shown = computed(() => {
  const words = filter.value.trim().toLowerCase()
  return props.options.filter((option) => !words || `${option.name} ${[option.meta ?? ''].flat().join(' ')}`.toLowerCase().includes(words))
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
      <ul v-if="shown.length" class="pick-list">
        <li v-for="option in shown" :key="option.id" :class="{ blocked: option.blocked && option.id !== current }">
          <div class="pick-about">
            <span class="pick-name"><InfoButton v-if="option.info" :info="option.info" :label="option.name" /><template v-else>{{ option.name }}</template></span>
            <span v-if="Array.isArray(option.meta)" class="pick-meta sep"><span v-for="fact in option.meta" :key="fact">{{ fact }}</span></span>
            <span v-else-if="option.meta" class="pick-meta">{{ option.meta }}</span>
            <span v-if="option.text" class="pick-text">{{ option.text }}</span>
          </div>
          <div class="pick-action">
            <button v-if="option.id === current" type="button" class="small" disabled>Chosen</button>
            <template v-else>
              <button
                type="button"
                class="small"
                :disabled="saving || !!option.blocked"
                :aria-describedby="option.blocked ? `why-${option.id}` : undefined"
                @click="emit('choose', option.id)"
              >
                Choose
              </button>
              <span v-if="option.blocked" :id="`why-${option.id}`" class="pick-reason">{{ option.blocked }}</span>
            </template>
          </div>
        </li>
      </ul>
      <p v-else class="empty">{{ filter ? 'Nothing matches that search.' : empty ?? 'Nothing to choose from yet: the content packs may not be imported.' }}</p>
    </div>
  </dialog>
</template>
