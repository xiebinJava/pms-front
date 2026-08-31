import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import 'uno.css'
import '/@/styles/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(Antd)
app.use(router)
app.mount('#app')
