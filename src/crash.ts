// The crash screen: plain DOM, so it shows even when Vue itself failed to start. Wired up in main.ts.

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i
const NOISE = /ResizeObserver loop|AbortError|The user aborted a request|The operation was aborted/i

const message = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error))

// A deploy replaced the old chunk files: one reload fetches the new ones. The flag stops a reload loop.
function reloadOnce() {
  if (sessionStorage.getItem('chunk-reload')) return false
  sessionStorage.setItem('chunk-reload', '1')
  location.reload()
  return true
}

const browser = () => /Edg\//.test(navigator.userAgent) ? 'Edge' : /Firefox\//.test(navigator.userAgent) ? 'Firefox' : /Chrome\//.test(navigator.userAgent) ? 'Chrome' : /Safari\//.test(navigator.userAgent) ? 'Safari' : 'Unknown browser'

let shown = false
// Once the site is on screen, an error shows as a bar over it instead, so unsaved edits aren't wiped.
const started = () => Boolean(document.getElementById('app')?.children.length)

export function showCrash(error: unknown) {
  const text = message(error)
  if (shown || NOISE.test(text)) return
  if (CHUNK_ERROR.test(text) && reloadOnce()) return
  shown = true
  console.error(error)

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, content: string) => {
    const el = document.createElement(tag)
    el.className = className
    el.textContent = content
    return el
  }
  const reload = make('button', 'primary', 'Reload')
  reload.type = 'button'
  reload.addEventListener('click', () => location.reload())
  const bar = started()
  const page = make(bar ? 'div' : 'main', bar ? 'crash crash-bar' : 'crash', '')
  page.setAttribute('role', 'alert')
  page.append(
    make(bar ? 'h2' : 'h1', '', 'Something went wrong'),
    make('p', '', 'Reload the page. If it keeps happening, send a GM a screenshot of this.'),
    make('pre', 'crash-details', `${text}\n${location.pathname}\n${browser()}`),
    reload,
  )
  if (!bar) return document.body.replaceChildren(page)
  const close = make('button', '', 'Close')
  close.type = 'button'
  close.addEventListener('click', () => {
    page.remove()
    shown = false
  })
  reload.after(close)
  document.body.append(page)
  reload.focus()
}

export function watchForCrashes() {
  window.addEventListener('error', (event) => showCrash(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => showCrash(event.reason))
  // Vite fires this when a lazy chunk can't be fetched.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    showCrash(new Error('Failed to fetch dynamically imported module'))
  })
}
