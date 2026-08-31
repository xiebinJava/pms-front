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
      meta: { title: '登录' },
    },
    {
      path: '/auth/activate',
      name: 'activate',
      component: () => import('/@/views/auth/activate.vue'),
      meta: { title: '激活账号' },
    },
    {
      path: '/auth/reset-password',
      name: 'reset-password',
      component: () => import('/@/views/auth/reset-password.vue'),
      meta: { title: '重置密码' },
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
          meta: { title: '工作台' },
        },
        {
          path: 'manual',
          name: 'manual',
          component: () => import('/@/views/manual/index.vue'),
          meta: { title: '使用手册' },
        },
        {
          path: 'projects',
          name: 'project-list',
          component: () => import('/@/views/project/list/index.vue'),
          meta: { title: '项目管理' },
        },
        {
          path: 'projects/:id',
          name: 'project-detail',
          component: () => import('/@/views/project/detail/index.vue'),
          meta: { title: '项目详情' },
        },
        { path: 'admin/users', name: 'admin-users', component: () => import('/@/views/admin/users/index.vue'), meta: { title: '人员与权限', permission: 'admin:user:read' } },
        { path: 'admin/org', name: 'admin-org', component: () => import('/@/views/admin/org/index.vue'), meta: { title: '组织架构', permission: 'admin:org:read' } },
        { path: 'admin/roles', name: 'admin-roles', component: () => import('/@/views/admin/roles/index.vue'), meta: { title: '角色管理', permission: 'admin:role:read' } },
        { path: 'admin/import', name: 'admin-import', component: () => import('/@/views/admin/import/index.vue'), meta: { title: '批量导入', permission: 'admin:import:write' } },
        { path: 'admin/audit', name: 'admin-audit', component: () => import('/@/views/admin/audit/index.vue'), meta: { title: '审计日志', permission: 'admin:audit:read' } },
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
