import { defineStore } from 'pinia'
import { login as loginApi, getMe } from '/@/api/auth'
import { TOKEN_KEY } from '/@/plugins/http'
import type { User } from '/@/types/domain'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: null as User | null,
  }),
  getters: {
    isLogin: (state) => !!state.token,
  },
  actions: {
    async login(username: string, password: string) {
      const data = await loginApi(username, password)
      this.token = data.token
      this.user = data.user
      localStorage.setItem(TOKEN_KEY, data.token)
    },
    async fetchMe() {
      this.user = await getMe()
      return this.user
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
    },
  },
})
