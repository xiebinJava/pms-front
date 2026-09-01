import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { useLocaleStore } from './store/locale'
import 'uno.css'
import '/@/styles/index.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.use(Antd)
app.use(router)
useLocaleStore(pinia).initFromStorage()
app.mount('#app')
