import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '/@/store/user'
import { canAccessAdminRoute } from './admin-guard'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('/@/views/login/index.vue'),
      meta: { titleKey: 'route.login' },
    },
    {
      path: '/auth/activate',
      name: 'activate',
      component: () => import('/@/views/auth/activate.vue'),
      meta: { titleKey: 'route.activate' },
    },
    {
      path: '/auth/reset-password',
      name: 'reset-password',
      component: () => import('/@/views/auth/reset-password.vue'),
      meta: { titleKey: 'route.resetPassword' },
    },
    {
      path: '/',
      component: () => import('/@/layout/Index.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('/@/views/workbench/index.vue'),
          meta: { titleKey: 'route.dashboard' },
        },
        {
          path: 'manual',
          name: 'manual',
          component: () => import('/@/views/manual/index.vue'),
          meta: { titleKey: 'route.manual' },
        },
        {
          path: 'projects',
          name: 'project-list',
          component: () => import('/@/views/project/list/index.vue'),
          meta: { titleKey: 'route.projectList' },
        },
        {
          path: 'projects/:id',
          name: 'project-detail',
          component: () => import('/@/views/project/detail/index.vue'),
          meta: { titleKey: 'route.projectDetail' },
        },
        { path: 'admin/users', name: 'admin-users', component: () => import('/@/views/admin/users/index.vue'), meta: { titleKey: 'route.adminUsers', permission: 'admin:user:read' } },
        { path: 'admin/org', name: 'admin-org', component: () => import('/@/views/admin/org/index.vue'), meta: { titleKey: 'route.adminOrg', permission: 'admin:org:read' } },
        { path: 'admin/roles', name: 'admin-roles', component: () => import('/@/views/admin/roles/index.vue'), meta: { titleKey: 'route.adminRoles', permission: 'admin:role:read' } },
        { path: 'admin/import', name: 'admin-import', component: () => import('/@/views/admin/import/index.vue'), meta: { titleKey: 'route.adminImport', permission: 'admin:import:write' } },
        { path: 'admin/audit', name: 'admin-audit', component: () => import('/@/views/admin/audit/index.vue'), meta: { titleKey: 'route.adminAudit', permission: 'admin:audit:read' } },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const store = useUserStore()
  if (!['/login', '/auth/activate', '/auth/reset-password'].includes(to.path) && !store.isLogin) {
    try {
      await store.restore()
    } catch {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
  }
  if (to.path === '/login' && store.isLogin) {
    return '/'
  }
  if (to.meta.permission && !canAccessAdminRoute(store.user, to.meta.permission as string)) {
    return { path: '/projects' }
  }
  return true
})

export default router
