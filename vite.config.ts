import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    resolve: {
      alias: {
        '/@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [vue(), UnoCSS()],
    server: {
      port: Number(env.VITE_PORT || 5173),
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
          // The backend intentionally rejects unknown Origin values. During local
          // development the proxy is same-origin, so do not forward the browser
          // origin as a cross-site request.
          configure: (proxy) => {
            proxy.on('proxyReq', (request) => request.removeHeader('origin'))
          },
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            antd: ['ant-design-vue', '@ant-design/icons-vue'],
            axios: ['axios'],
          },
        },
      },
    },
  }
})
