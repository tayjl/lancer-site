import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ session: { value: null as unknown } }))
vi.mock('./auth', async () => {
  const { ref } = await import('vue')
  auth.session = ref(null)
  return { authReady: Promise.resolve(), session: auth.session }
})
// No browser here: history in memory, and views that need no real code.
vi.mock('vue-router', async (original) => {
  const real = await original<typeof import('vue-router')>()
  return { ...real, createWebHistory: () => real.createMemoryHistory() }
})
vi.mock('./views/LoginView.vue', () => ({ default: {} }))
vi.mock('./views/HomeView.vue', () => ({ default: {} }))
vi.mock('./views/PilotManageView.vue', () => ({ default: {} }))
vi.mock('./views/PrivacyView.vue', () => ({ default: {} }))

import { pilotList, router } from './router'

const document = { title: '' }
vi.stubGlobal('document', document)

beforeEach(async () => {
  auth.session.value = null
  await router.replace('/privacy')
})

describe('router guards', () => {
  it('sends a logged-out visitor to the login page', async () => {
    await router.push('/pilot')
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('lets a logged-out visitor see public pages', async () => {
    await router.push('/privacy')
    expect(router.currentRoute.value.name).toBe('privacy')
  })

  it('lets a logged-in user see a private page', async () => {
    auth.session.value = { user: { id: 'u' } }
    await router.push('/pilot')
    expect(router.currentRoute.value.name).toBe('pilot')
  })

  it('sends a logged-in user away from the login page', async () => {
    auth.session.value = { user: { id: 'u' } }
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('marks GM and owner pages in the route meta', () => {
    expect(router.resolve('/gm/pilots').meta.gm).toBe(true)
    expect(router.resolve('/gm/content').meta.owner).toBe(true)
    expect(router.resolve('/pilot').meta.gm).toBeUndefined()
  })
})

describe('tab title', () => {
  it('is the page title then the site name', async () => {
    auth.session.value = { user: { id: 'u' } }
    await router.push('/pilot')
    expect(document.title).toBe('My pilot - HOR_OS')
  })

  it('is the site name alone on a page with no title', async () => {
    await router.push('/login')
    expect(document.title).toBe('HOR_OS')
  })
})

describe('pilotList', () => {
  it('points each status at its list', () => {
    expect(pilotList('pending').label).toBe('Pending')
    expect(pilotList('dead').label).toBe('Memorial')
    expect(pilotList('approved').label).toBe('Registry')
    expect(pilotList(undefined).label).toBe('Registry')
  })
})
