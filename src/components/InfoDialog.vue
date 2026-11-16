<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { loadManufacturers, makerColour, makerLogo } from '../archive'
import { shownInfo, type Manufacturer } from '../info'
import Icon from './Icon.vue'
import InfoBody from './InfoBody.vue'

// The full information on one thing (src/info.ts), mounted once in App.vue and opened with showInfo(). It opens
// on top of a picker, so players can read an option in full before choosing it. The head (its kind as a label, its
// name, Close), then InfoBody.vue, which the archives' detail pane shares.
const dialog = useTemplateRef('dialog')
const closed = () => { shownInfo.value = null }
watch(shownInfo, (info) => {
  if (info && !dialog.value?.open) dialog.value?.showModal()
  if (!info) dialog.value?.close()
})

// Something made by a manufacturer shows its logo and takes its colour for the dialog's border (only there: never the
// text). The manufacturers are only fetched once something with one is first shown.
const manufacturers = shallowRef<Manufacturer[]>([])
let asked = false
watch(shownInfo, (info) => {
  if (info?.source && !asked) {
    asked = true
    loadManufacturers().then((list) => (manufacturers.value = list))
  }
})
const maker = computed(() => manufacturers.value.find((entry) => entry.id === shownInfo.value?.source))
const logo = computed(() => makerLogo(maker.value))
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog info"
    :style="maker ? { '--mf': makerColour(maker) } : undefined"
    :aria-label="shownInfo ? `${shownInfo.kind}: ${shownInfo.name}` : 'Full information'"
    @close="closed"
    @click.self="dialog?.close()"
  >
    <!-- The parts fill the dialog, so a click on the dialog itself is a click on the backdrop. -->
    <header v-if="shownInfo" class="dialog-head">
      <div class="title">
        <Icon v-if="logo" class="logo" :src="logo" />
        <div>
          <p class="label">{{ shownInfo.kind }}</p>
          <h2>{{ shownInfo.name }}</h2>
        </div>
      </div>
      <button type="button" class="small" autofocus @click="dialog?.close()">Close</button>
    </header>
    <InfoBody v-if="shownInfo" class="dialog-body" :info="shownInfo" />
  </dialog>
</template>

<style scoped>
/* The dialog frame is style.css's .dialog (its border takes --mf), wider here for the radar and cards. */
.info {
  width: min(60rem, calc(100vw - 2rem));
}

.title {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-m);
  min-width: 0;
}

.logo {
  width: 32px;
  height: 32px;
  color: var(--mf);
}

.title .label,
.title h2 {
  margin: 0;
}

.title h2 {
  font-size: var(--fs-l);
  overflow-wrap: anywhere;
}
</style>
