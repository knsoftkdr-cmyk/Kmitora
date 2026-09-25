import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import fs from "node:fs"
import path from "node:path"

const PORT_STATE_DIR = path.resolve(__dirname, "..", "runtime", "port_state")

const DEFAULT_PORTS: Record<string, number> = {
  core: 8090,
  source: 8081,
  target: 8082,
  assistant: 8083
}

function readPort(service: string): number {
  try {
    const raw = fs.readFileSync(path.join(PORT_STATE_DIR, `${service}.json`), "utf-8")
    const data = JSON.parse(raw)
    if (typeof data.port === "number") return data.port
  } catch {
    // fall through to default below
  }
  return DEFAULT_PORTS[service]
}

function kmitoraPortsPlugin(): Plugin {
  return {
    name: "kmitora-ports-endpoint",
    configureServer(server) {
      server.middlewares.use("/__kmitora_ports", (_req, res) => {
        const ports = {
          core: readPort("core"),
          source: readPort("source"),
          target: readPort("target"),
          assistant: readPort("assistant")
        }
        res.setHeader("Content-Type", "application/json")
        res.end(JSON.stringify(ports))
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), kmitoraPortsPlugin()],

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
        target: `http://127.0.0.1:${DEFAULT_PORTS.target}`,
        router: () => `http://127.0.0.1:${readPort("target")}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/target-api/, "")
      },
      "/source-api": {
        target: `http://127.0.0.1:${DEFAULT_PORTS.source}`,
        router: () => `http://127.0.0.1:${readPort("source")}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/source-api/, "")
      },
      "/api": {
        target: `http://127.0.0.1:${DEFAULT_PORTS.core}`,
        router: () => `http://127.0.0.1:${readPort("core")}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      },

      "/v1": {
        target: `http://127.0.0.1:${DEFAULT_PORTS.core}`,
        router: () => `http://127.0.0.1:${readPort("core")}`,
        changeOrigin: true
      },

      "/health": {
        target: `http://127.0.0.1:${DEFAULT_PORTS.core}`,
        router: () => `http://127.0.0.1:${readPort("core")}`,
        changeOrigin: true
      }
    }
  }
})
