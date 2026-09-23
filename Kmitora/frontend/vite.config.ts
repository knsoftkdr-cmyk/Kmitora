import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],

  server: {
    host: "0.0.0.0",
    port: 5173,

    allowedHosts: [
      ".trycloudflare.com",
      "localhost",
      "127.0.0.1"
    ],

    proxy: {
      "/target-api": {
        target: "http://127.0.0.1:8082",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/target-api/, "")
      },
      "/source-api": {
        target: "http://127.0.0.1:8081",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/source-api/, "")
      },
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      },

      "/v1": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true
      },

      "/health": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true
      }
    }
  }
})