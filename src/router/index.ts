import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Sessions from '../views/Sessions.vue'
import SessionDetail from '../views/SessionDetail.vue'
import Notes from '../views/Notes.vue'
import Ego from '../views/Ego.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/login', name: 'Login', component: Login },
  { path: '/', name: 'Sessions', component: Sessions, meta: { requiresAuth: true } },
  { path: '/session/:id', name: 'SessionDetail', component: SessionDetail, meta: { requiresAuth: true } },
  { path: '/notes', name: 'Notes', component: Notes, meta: { requiresAuth: true } },
  { path: '/ego', name: 'Ego', component: Ego, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return '/login'
  }
  if (to.path === '/login' && auth.isLoggedIn) {
    return '/'
  }
})

export default router
