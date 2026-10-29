import { createRouter, createWebHistory } from 'vue-router'
import { authReady, session } from './auth'
import type { Tables } from './lib/database.types'
import ContentView from './views/ContentView.vue'
import GmChangesView from './views/GmChangesView.vue'
import GmChangeView from './views/GmChangeView.vue'
import GmPilotsView from './views/GmPilotsView.vue'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import MechView from './views/MechView.vue'
import PilotManageView from './views/PilotManageView.vue'
import RegistryView from './views/RegistryView.vue'

// The site is character management only: your pilot, the pilot lists, and the GM side of approving and
// levelling them, plus the game content they're built from. The top bar's tabs are in App.vue.
// Each page's meta: "title" and "summary" head the page (PageHeader.vue). "section" names the tab to mark as
// current on a page under it (a pilot record under the registry). "gm" pages are for GMs and owners only;
// "owner" pages for owners only. The database enforces who can do what; these only decide what's shown.
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    summary?: string
    section?: string
    gm?: boolean
    owner?: boolean
    public?: boolean
    // Card grids (RegistryView): which pilots to list, and what to say when there are none.
    status?: Tables<'characters'>['status']
    empty?: string
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Home: the login screen's boot scrawl, with buttons to every tab. The logo in the top bar links here.
    { path: '/', name: 'home', component: HomeView, meta: { title: 'home' } },
    {
      path: '/pilot',
      name: 'pilot',
      component: PilotManageView,
      meta: { title: 'my pilot' },
    },
    // One of your mechs.
    {
      path: '/pilot/mechs/:mechId',
      name: 'mech',
      component: MechView,
      meta: { title: 'mech', section: 'pilot' },
    },
    {
      path: '/registry',
      name: 'registry',
      component: RegistryView,
      meta: { title: 'pilot registry', summary: 'every approved pilot.', status: 'approved', empty: 'no approved pilots yet.' },
    },
    // A pilot's record: the pilot sheet, read-only (and its mechs' pages).
    {
      path: '/registry/:id',
      name: 'pilot-record',
      component: PilotManageView,
      meta: { title: 'pilot record', section: 'registry' },
    },
    {
      path: '/registry/:id/mechs/:mechId',
      name: 'record-mech',
      component: MechView,
      meta: { title: 'mech', section: 'registry' },
    },
    // New pilots waiting on a GM, for everyone to read. GMs review them from the gm pilots tab. Changes to
    // approved pilots hold private data, so they're only in the gm changes tab.
    {
      path: '/pending',
      name: 'pending',
      component: RegistryView,
      meta: {
        title: 'pending pilots',
        summary: 'new pilots waiting on a gm.',
        status: 'pending',
        empty: 'nothing waiting on a gm.',
      },
    },
    {
      path: '/memorial',
      name: 'memorial',
      component: RegistryView,
      meta: { title: 'memorial', summary: 'pilots who died. their records are kept.', status: 'dead', empty: 'no one has died yet.' },
    },
    // GM tabs. /gm opens the first one.
    { path: '/gm', name: 'gm', redirect: { name: 'gm-pilots' } },
    {
      path: '/gm/pilots',
      name: 'gm-pilots',
      component: GmPilotsView,
      meta: { title: 'gm: pilots', summary: 'review new pilots, and level up or pay any pilot.', gm: true },
    },
    // A pilot's record with the GM controls and, while pending, the decision. Opened from gm: pilots.
    {
      path: '/gm/pilots/:id',
      name: 'gm-review',
      component: PilotManageView,
      meta: { title: 'gm review', gm: true, section: 'gm-pilots' },
    },
    {
      path: '/gm/changes',
      name: 'gm-changes',
      component: GmChangesView,
      meta: { title: 'gm: changes', summary: 'changes players want to make to their approved pilots.', gm: true },
    },
    // One change: what it changes, then approve or reject.
    {
      path: '/gm/changes/:id',
      name: 'gm-change',
      component: GmChangeView,
      meta: { title: 'gm: change', gm: true, section: 'gm-changes' },
    },
    {
      path: '/gm/content',
      name: 'gm-content',
      component: ContentView,
      meta: { title: 'gm: content', summary: 'the game content pilots are built from.', gm: true, owner: true },
    },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// Every page needs a login except /login itself.
// This only decides which page to show. The real protection is the database's RLS rules,
// because anyone can skip code that runs in their own browser.
router.beforeEach(async (to) => {
  await authReady
  if (!to.meta.public && !session.value) return { name: 'login' }
  if (to.name === 'login' && session.value) return { name: 'home' }
})
