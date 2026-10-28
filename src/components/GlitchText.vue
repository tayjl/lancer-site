<script setup lang="ts">
// Text that glitches once when it appears, or every few seconds with `loop`.
// Use it sparingly: the login wordmark and page titles only.
defineProps<{ text: string; loop?: boolean }>()
</script>

<template>
  <span class="glitch" :class="{ loop }" :data-text="text">{{ text }}</span>
</template>

<style scoped>
.glitch {
  position: relative;
  display: inline-block;
}

/* Two offset copies of the text, in the two accent colours, shown in thin slices for a moment. */
.glitch::before,
.glitch::after {
  content: attr(data-text);
  content: attr(data-text) / ''; /* stops screen readers reading the text three times */
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  animation: 2.4s steps(1, end) 1 both;
}

.glitch::before {
  color: var(--rose);
  animation-name: glitch-a;
}

.glitch::after {
  color: var(--text);
  animation-name: glitch-b;
}

.loop::before,
.loop::after {
  animation-duration: 7s;
  animation-iteration-count: infinite;
}

@keyframes glitch-a {
  0%,
  88%,
  100% {
    opacity: 0;
    transform: none;
  }
  90% {
    opacity: 0.85;
    transform: translateX(-3px);
    clip-path: inset(18% 0 58% 0);
  }
  93% {
    opacity: 0.85;
    transform: translateX(2px);
    clip-path: inset(62% 0 12% 0);
  }
  96% {
    opacity: 0.85;
    transform: translateX(-1px);
    clip-path: inset(4% 0 82% 0);
  }
}

@keyframes glitch-b {
  0%,
  89%,
  100% {
    opacity: 0;
    transform: none;
  }
  91% {
    opacity: 0.6;
    transform: translateX(3px);
    clip-path: inset(48% 0 30% 0);
  }
  94% {
    opacity: 0.6;
    transform: translateX(-2px);
    clip-path: inset(8% 0 70% 0);
  }
  97% {
    opacity: 0.6;
    transform: translateX(1px);
    clip-path: inset(72% 0 6% 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .glitch::before,
  .glitch::after {
    animation: none;
  }
}
</style>
