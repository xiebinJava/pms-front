import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '/@/store/user'

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
      path: '/',
      component: () => import('/@/layout/Index.vue'),
      children: [
        { path: '', redirect: '/projects' },
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
      ],
    },
  ],
})

router.beforeEach((to) => {
  const store = useUserStore()
  if (to.path !== '/login' && !store.isLogin) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && store.isLogin) {
    return '/'
  }
  return true
})

export default router
