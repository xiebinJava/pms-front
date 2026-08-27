import { defineStore } from 'pinia'
import { login as loginApi, getMe, refreshSession } from '/@/api/auth'
import { clearAccessToken, getAccessToken, setAccessToken } from '/@/plugins/http'
import type { User } from '/@/types/domain'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getAccessToken(),
    user: null as User | null,
  }),
  getters: {
    isLogin: (state) => !!state.token,
    displayName: (state) => state.user?.displayName || state.user?.nickname || state.user?.username || '未登录',
    can: (state) => (permission: string) => state.user?.systemRole === 1 || !!state.user?.permissionCodes?.includes(permission),
  },
  actions: {
    async login(username: string, password: string) {
      const data = await loginApi(username, password)
      const token = data.accessToken || data.token || ''
      setAccessToken(token)
      this.token = token
      this.user = data.user
    },
    async fetchMe() {
      this.user = await getMe()
      return this.user
    },
    async restore() {
      const data = await refreshSession()
      const token = data.accessToken || data.token || ''
      setAccessToken(token)
      this.token = token
      this.user = data.user
      return this.user
    },
    logout() {
      clearAccessToken()
      this.token = ''
      this.user = null
    },
  },
})
