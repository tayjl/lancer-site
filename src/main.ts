import { createApp } from 'vue'
import '@fontsource-variable/cascadia-mono'
import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource-variable/atkinson-hyperlegible-next/wght-italic.css'
import './style.css'
import App from './App.vue'
import { showCrash, watchForCrashes } from './crash'
import { router } from './router'

watchForCrashes()
const app = createApp(App).use(router)
app.config.errorHandler = (error) => showCrash(error)
// Wait for the first login check, so the wrong page never flashes up.
router.isReady().then(() => {
  app.mount('#app')
  // A later deploy may need its own one-time reload (src/crash.ts), so the guard clears once this page has been fine a while.
  setTimeout(() => sessionStorage.removeItem('chunk-reload'), 10000)
})
