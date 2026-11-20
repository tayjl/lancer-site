<script setup lang="ts">
// One numbered section of the pilot file: its number in mono, the title, a short pilot-colour dash on a hairline, and a
// spot at the right (`#<id>-extra`) that a section's own component can teleport its buttons and counts into.
import { isFolded, setFolded } from '../fileSections'
import Icon from './Icon.vue'

// `fixed` sections (Identity) can't be folded. A folded body stays mounted (v-show), so unsaved fields and open pickers survive.
defineProps<{ id: string; no: string; title: string; fixed?: boolean }>()
</script>

<template>
  <section :id="id" :aria-labelledby="`${id}-title`" class="file-section">
    <header class="sec-head">
      <h2 :id="`${id}-title`">
        <button v-if="!fixed" type="button" class="sec-toggle" :aria-expanded="!isFolded(id)" :aria-controls="`${id}-body`" @click="setFolded(id, !isFolded(id))">
          <Icon :name="isFolded(id) ? 'chevron-right' : 'chevron-down'" />
          <span class="sec-no num">{{ no }}</span>{{ title }}
        </button>
        <template v-else><span class="sec-no num">{{ no }}</span>{{ title }}</template>
      </h2>
      <span class="sec-rule" aria-hidden="true"></span>
      <span :id="`${id}-extra`" class="sec-extra"></span>
    </header>
    <div :id="`${id}-body`" v-show="fixed || !isFolded(id)"><slot /></div>
  </section>
</template>

<style scoped>
/* Clears the top bar, and on phones the index row under it. */
.file-section {
  scroll-margin-top: calc(var(--topbar-h) + var(--space-l));
}

.sec-head {
  display: flex;
  flex-wrap: wrap; /* extras too wide for the row go to the next line as one group, never over the title */
  align-items: center;
  gap: var(--space-s) var(--space-m);
  margin-bottom: var(--space-l);
}

.sec-no {
  margin-right: var(--space-m);
  color: var(--text-dim);
  font-size: var(--fs-s);
}

/* A folded section's head keeps a bottom gap of its own only while open. */
.sec-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-s);
  min-height: var(--tap);
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
}

.sec-toggle:hover,
.sec-toggle:focus-visible {
  color: var(--lilac);
}

.sec-toggle:hover .sec-no,
.sec-toggle:focus-visible .sec-no {
  color: inherit;
}

.sec-head h2 {
  margin: 0;
  font-size: 14px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.sec-rule {
  position: relative;
  flex: 1;
  min-width: var(--space-l);
  height: 1px;
  background: var(--rule);
}

/* The pilot's colour is decoration only. */
.sec-rule::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 0;
  width: 2.5rem;
  height: 3px;
  background: var(--pilot, var(--edge));
}

.sec-extra {
  display: flex;
  align-items: center;
  gap: var(--space-m);
  color: var(--text-dim);
  font-size: var(--fs-s);
  white-space: nowrap;
}

.sec-extra:empty {
  display: none;
}

@media (max-width: 56rem) {
  .file-section {
    scroll-margin-top: calc(var(--topbar-h) + var(--tabs-h) + var(--space-m));
  }
}

/* Phones: one pattern for every head (sub-heads too, .sheet-head in style.css). The title on the left with its button at
   the right of the same line; counts, notes and blocked reasons each on a line of their own under the title, left-aligned.
   The extras' boxes drop out so each part sits on the head's grid. Buttons go first (order), so a second one stacks under
   the first and the notes always come below. Buttons never break. */
@media (max-width: 40rem) {
  .sec-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-xs) var(--space-m);
  }

  .sec-head h2 {
    grid-area: 1 / 1;
    white-space: normal; /* a long title wraps rather than running under the button */
  }

  .sec-toggle {
    text-align: left;
  }

  .sec-rule {
    display: none;
  }

  .sec-extra,
  .sec-extra :deep(span.blocked) {
    display: contents;
  }

  .sec-extra > :deep(*),
  .sec-extra :deep(.blocked-reason) {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .sec-extra :deep(button) {
    grid-column: 2;
    order: -1;
    white-space: nowrap;
  }

  /* The label says what the button does, so its plus symbol gives way to the title. */
  .sec-extra :deep(button .icon) {
    display: none;
  }
}
</style>
