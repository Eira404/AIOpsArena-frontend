import '@/assets/css/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import 'vue3-json-viewer/dist/index.css'

import App from './App.vue'
import router from './router'
import { Madison } from './core/madison'

console.log(
  '%cWelcome to %cAI%cOps %cArena%c!',
  'color:#white; font-size:20px; font-weight:bold;',
  'color: #4FADFF; font-size:20px; font-weight:bold;',
  'color:#white; font-size:20px; font-weight:bold;',
  'color:#FF87C8; font-size:20px; font-weight:bold;',
  'color:#white; font-size:20px; font-weight:bold;'
)

console.log('%cProduced by Eira404 → https://github.com/Eira404/AIOpsArena-frontend',
  'font-size:16px; font-weight:bold;'
)

/**
 * 减小暗黑模式下白屏加载时间
 */
import { localGet, localSet } from './utils/stroage'
let t = localGet('THEME', 'light')
t = t === 'light' ? 'light' : 'dark'
localSet('THEME', t)
const light = t === 'light'
if (!light) {
  document.documentElement.classList.add('dark')
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.use(Madison.getInstance().i18n.i18n)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
