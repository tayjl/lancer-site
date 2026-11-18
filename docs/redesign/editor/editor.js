/* Mockup behaviour only: which phone screen shows (?screen=list|form|preview), the Edit | Preview tabs, the
   Card | Full information tabs, and the mobile menu. Nothing here is meant for src/. */
const q = new URLSearchParams(location.search)
const setScreen = (s) => {
  document.body.dataset.screen = s
  document.querySelectorAll('.mtabs [data-screen-set]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.screenSet === s)))
}
setScreen(q.get('screen') || 'form')

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-screen-set]')
  if (t) {
    setScreen(t.dataset.screenSet)
    window.scrollTo(0, 0)
    return
  }
  const p = t || e.target.closest('[data-pane]')
  if (p) {
    const group = p.closest('[data-tabgroup]')
    group.querySelectorAll('[data-pane]').forEach((b) => {
      const on = b === p
      b.setAttribute('aria-selected', String(on))
      document.getElementById(b.dataset.pane).hidden = !on
    })
    return
  }
  if (e.target.closest('[data-menu]')) {
    const d = document.getElementById('drawer')
    const open = d.classList.toggle('open')
    e.target.closest('[data-menu]').setAttribute('aria-expanded', String(open))
  }
})
