import { createRouter, createWebHistory } from 'vue-router'
import { authReady, session } from './auth'
import LoginView from './views/LoginView.vue'

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
    // A wider page and top bar (120rem, not 84rem), for working pages such as the content editor.
    wide?: boolean
  }
}

const PITHUB_META = { title: 'Pithub', summary: 'Files that were never meant to leak.', section: 'pithub' }
const LORE_META = { title: 'Lore', summary: 'Stories, places and people of the campaign, written by the GMs.', section: 'lore' }

// Every page but the login screen loads its code when first visited, so the first paint downloads less.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Home: the login screen's boot scrawl, with buttons to every tab. The logo in the top bar links here.
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue'), meta: { title: 'Home' } },
    {
      path: '/pilot',
      name: 'pilot',
      component: () => import('./views/PilotManageView.vue'),
      meta: { title: 'My pilot' },
    },
    // One of your mechs.
    {
      path: '/pilot/mechs/:mechId',
      name: 'mech',
      component: () => import('./views/MechView.vue'),
      meta: { title: 'Mech', section: 'pilot' },
    },
    {
      path: '/registry',
      name: 'registry',
      component: () => import('./views/RegistryView.vue'),
      meta: { title: 'Pilot registry' },
    },
    // A pilot's record: the pilot sheet, read-only (and its mechs' pages).
    {
      path: '/registry/:id',
      name: 'pilot-record',
      component: () => import('./views/PilotManageView.vue'),
      meta: { title: 'Pilot record', section: 'registry' },
    },
    {
      path: '/registry/:id/mechs/:mechId',
      name: 'record-mech',
      component: () => import('./views/MechView.vue'),
      meta: { title: 'Mech', section: 'registry' },
    },
    // The pending and memorial lists are tabs of the registry (RegistryView.vue). Old links keep working.
    { path: '/pending', redirect: { name: 'registry', query: { list: 'pending' } } },
    { path: '/memorial', redirect: { name: 'registry', query: { list: 'memorial' } } },
    // Every piece of game content, browsable and searchable (ArchivesView.vue).
    {
      path: '/archives',
      name: 'archives',
      component: () => import('./views/ArchivesView.vue'),
      meta: { title: 'Archives' },
    },
    { path: '/combat', name: 'combat', component: () => import('./views/CombatView.vue'), meta: { title: 'Combat' } },
    // Lore the GMs write: the list with the newest entry (or the one in the url) beside it. /lore/:id urls are shared on Discord.
    { path: '/lore', name: 'lore', component: () => import('./views/LoreView.vue'), meta: LORE_META },
    { path: '/lore/:id', name: 'lore-entry', component: () => import('./views/LoreView.vue'), meta: LORE_META },
    { path: '/lore/:id/edit', name: 'lore-edit', component: () => import('./views/LoreEditView.vue'), meta: { ...LORE_META, gm: true } },
    // Pithub: lore's table in its own terminal view (PithubView.vue). Reached by the home page's art, not the tabs.
    { path: '/pithub', name: 'pithub', component: () => import('./views/PithubView.vue'), meta: PITHUB_META },
    { path: '/pithub/:id', name: 'pithub-entry', component: () => import('./views/PithubView.vue'), meta: PITHUB_META },
    { path: '/pithub/:id/edit', name: 'pithub-edit', component: () => import('./views/LoreEditView.vue'), meta: { ...PITHUB_META, gm: true } },
    // GM tabs. /gm opens the first one.
    { path: '/gm', name: 'gm', redirect: { name: 'gm-pilots' } },
    {
      path: '/gm/pilots',
      name: 'gm-pilots',
      component: () => import('./views/GmPilotsView.vue'),
      meta: { title: 'GM pilots', summary: 'Review new pilots. Set levels and manna.', gm: true },
    },
    // A pilot's record with the GM controls and, while pending, the decision. Opened from gm: pilots.
    {
      path: '/gm/pilots/:id',
      name: 'gm-review',
      component: () => import('./views/PilotManageView.vue'),
      meta: { title: 'GM review', gm: true, section: 'gm-pilots' },
    },
    {
      path: '/gm/changes',
      name: 'gm-changes',
      component: () => import('./views/GmChangesView.vue'),
      meta: { title: 'GM changes', summary: 'Changes to approved pilots.', gm: true },
    },
    // One change: what it changes, then approve or reject.
    {
      path: '/gm/changes/:id',
      name: 'gm-change',
      component: () => import('./views/GmChangeView.vue'),
      meta: { title: 'GM change', gm: true, section: 'gm-changes' },
    },
    {
      path: '/gm/content',
      name: 'gm-content',
      component: () => import('./views/ContentView.vue'),
      meta: { title: 'GM content', summary: 'Game content packs.', gm: true, owner: true },
    },
    // The in-browser editor for game content (owners only), under the content tab.
    {
      path: '/gm/content/editor',
      name: 'gm-content-editor',
      component: () => import('./views/ContentEditorView.vue'),
      meta: { title: 'Content editor', summary: 'Make and change game content.', gm: true, owner: true, section: 'gm-content', wide: true },
    },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/privacy', name: 'privacy', component: () => import('./views/PrivacyView.vue'), meta: { title: 'Privacy', public: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFoundView.vue'), meta: { title: 'Page not found' } },
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

// The list a pilot is in, by status: a link to it and its label (the record's breadcrumb).
export const pilotList = (status: string | undefined) =>
  status === 'pending' ? { to: { name: 'registry', query: { list: 'pending' } }, label: 'Pending' }
  : status === 'dead' ? { to: { name: 'registry', query: { list: 'memorial' } }, label: 'Memorial' }
  : { to: { name: 'registry' }, label: 'Registry' }
