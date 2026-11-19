<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { frameArtUrl, imageUrl, type FrameArt } from '../images'
import Icon from './Icon.vue'

// The one place a mech's picture is drawn (hangar cards, the mech page, licence cards, the frame picker, the
// information dialog, the frame editor). It always shows something, in this order:
//   1. "src": the mech's own upload (a stored path, src/images.ts). A plain picture with rounded corners.
//   2. "art": its frame's picture (a cut-out, drawn straight on the page).
//   3. A placeholder: the maker's "logo" if known, else the frame symbol, dim, in the middle of the same space.
// A picture that fails to load (a deleted upload, a missing file) falls through to the next one. The space is reserved
// by the "size" (one height per place), so nothing jumps while the picture loads and cards line up with or without art.
const props = withDefaults(
  defineProps<{
    src?: string | null
    art?: FrameArt | null
    logo?: string | null
    size: 'pick' | 'card' | 'overview' | 'licence' | 'info' | 'editor'
    alt?: string
    artAlt?: string
  }>(),
  { alt: 'Mech image', artAlt: 'Frame image' },
)

const upload = computed(() => imageUrl(props.src))
const uploadFailed = ref(false)
watch(() => props.src, () => (uploadFailed.value = false))

// The frame's picture: undefined while it loads, null when it has none or failed.
const artUrl = ref<string | null | undefined>(null)
let run = 0
watch(
  () => props.art,
  async (art) => {
    const mine = ++run
    artUrl.value = art ? undefined : null
    const next = art ? await frameArtUrl(art) : null
    if (mine === run) artUrl.value = next
  },
  { immediate: true },
)

const kind = computed(() => {
  if (upload.value && !uploadFailed.value) return 'upload'
  if (artUrl.value === undefined) return 'loading'
  return artUrl.value ? 'art' : 'none'
})
</script>

<template>
  <span class="mech-image" :class="[`size-${size}`, `kind-${kind}`]">
    <img v-if="kind === 'upload'" class="picture photo" :src="upload!" :alt="alt" decoding="async" @error="uploadFailed = true" />
    <img v-else-if="kind === 'art'" class="picture cutout" :src="artUrl!" :alt="artAlt" decoding="async" @error="artUrl = null" />
    <span v-else-if="kind === 'none'" class="none" role="img" aria-label="No image">
      <Icon v-if="logo" :src="logo" />
      <Icon v-else name="frame" />
    </span>
  </span>
</template>

<style scoped>
.mech-image {
  --h: 8rem;
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--h);
  color: var(--text-dim);
}

.picture {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
}

.photo {
  border-radius: var(--radius);
}

/* A cut-out stands on the bottom edge, so a row of cards shares one ground. */
.kind-art {
  align-items: flex-end;
}

.none .icon {
  width: calc(var(--h) / 2);
  height: calc(var(--h) / 2);
}

/* One height per place. */
.size-pick {
  --h: 64px;
  width: 64px;
}

.size-card {
  --h: 8rem;
}

.size-overview {
  --h: 16rem;
}

.size-licence {
  --h: 10rem;
  width: 11rem;
}

.size-info {
  --h: 16rem;
}

.size-editor {
  --h: 10rem;
}

@media (max-width: 40rem) {
  .size-pick {
    --h: 48px;
    width: 48px;
  }

  .size-overview {
    --h: 12rem;
  }

  .size-licence {
    --h: 8rem;
    width: 100%;
  }

  .size-info {
    --h: 12rem;
  }
}
</style>
