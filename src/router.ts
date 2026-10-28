import { createRouter, createWebHistory } from 'vue-router'
import { authReady, session } from './auth'
import LoginView from './views/LoginView.vue'
import MechView from './views/MechView.vue'
import ModuleOffline from './views/ModuleOffline.vue'
import PilotManageView from './views/PilotManageView.vue'
import PilotRecordView from './views/PilotRecordView.vue'
import RegistryView from './views/RegistryView.vue'

// Each page's meta: "title" is its name in the menu and the header path (e.g. ~/pilot_registry),
// and "summary" says what it's for. "gm" pages are for GMs and owners only.
// Pages that aren't built yet use the ModuleOffline placeholder.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/registry' },
    {
      path: '/registry',
      name: 'registry',
      component: RegistryView,
      meta: { title: 'pilot_registry', summary: 'every approved pilot on the net. public records only.' },
    },
    // "section" keeps pilot_registry highlighted in the menu while a record is open.
    {
      path: '/registry/:id',
      name: 'pilot-record',
      component: PilotRecordView,
      meta: { title: 'pilot_registry/record', section: 'registry' },
    },
    {
      path: '/pilot',
      name: 'pilot',
      component: PilotManageView,
      meta: { title: 'pilot_management', summary: 'your pilot: register it, view it, file changes.' },
    },
    // One of your mechs. "section" keeps pilot_management highlighted in the menu.
    {
      path: '/pilot/mechs/:mechId',
      name: 'mech',
      component: MechView,
      meta: { title: 'pilot_management/mech', section: 'pilot' },
    },
    {
      path: '/pending',
      name: 'pending',
      component: ModuleOffline,
      meta: { title: 'pending_paperwork', summary: 'pilots and changes waiting on a gm.' },
    },
    {
      path: '/memorial',
      name: 'memorial',
      component: ModuleOffline,
      meta: { title: 'those_who_passed', summary: 'pilots marked dead. records kept, never reopened.' },
    },
    {
      path: '/archive',
      name: 'archive',
      component: ModuleOffline,
      meta: { title: 'archive_viewer', summary: 'server lore: the setting, its factions and its history.' },
    },
    {
      path: '/gear/pilot',
      name: 'pilot-gear',
      component: ModuleOffline,
      meta: { title: 'pilot_gear', summary: 'armour, weapons and kit from the loaded content packs.' },
    },
    {
      path: '/gear/mech',
      name: 'mech-gear',
      component: ModuleOffline,
      meta: { title: 'mech_gear', summary: 'frames, weapons, systems and mods from the loaded content packs.' },
    },
    {
      path: '/gm',
      name: 'gm',
      component: ModuleOffline,
      meta: { title: 'gm_view', summary: 'review queue, reputation and owner tools.', gm: true },
    },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/:pathMatch(.*)*', redirect: '/registry' },
  ],
})

// Every page needs a login except /login itself.
// This only decides which page to show. The real protection is the database's RLS rules,
// because anyone can skip code that runs in their own browser.
router.beforeEach(async (to) => {
  await authReady
  if (!to.meta.public && !session.value) return { name: 'login' }
  if (to.name === 'login' && session.value) return { name: 'registry' }
})
