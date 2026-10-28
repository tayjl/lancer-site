import { createApp } from 'vue'
import '@fontsource-variable/cascadia-mono'
import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css'
import './style.css'
import App from './App.vue'
import { router } from './router'

const app = createApp(App).use(router)
// Wait for the first login check, so the wrong page never flashes up.
router.isReady().then(() => app.mount('#app'))
