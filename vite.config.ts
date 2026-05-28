import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.HERMES_API_URL || 'https://bhk.dmmeteo.dev'
  const user = env.HERMES_BASIC_USER || ''
  const pass = env.HERMES_BASIC_PASS || ''
  const sessionCookie = env.HERMES_SESSION_COOKIE || ''
  const sessionToken = env.HERMES_SESSION_TOKEN || ''
  const useSessionAuth = sessionCookie && sessionToken
  const basicAuth = !useSessionAuth && user && pass
    ? 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
    : ''

  return {
    base: '/',
    plugins: [inspectAttr(), react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (useSessionAuth) {
                proxyReq.setHeader('Cookie', `hermes_session=${sessionCookie}`)
                proxyReq.setHeader('x-hermes-session-token', sessionToken)
                proxyReq.setHeader('Origin', target)
                proxyReq.setHeader('Referer', `${target}/kanban`)
              } else if (basicAuth) {
                proxyReq.setHeader('Authorization', basicAuth)
              }
            })
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor'
            }
          },
        },
      },
    },
  }
})
