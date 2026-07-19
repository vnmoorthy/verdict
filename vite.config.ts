import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config tuned for Replit's *.replit.dev / *.repl.co / *.replit.app proxy.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind 0.0.0.0 so Replit's proxy can reach the dev server
    port: 5173,
    strictPort: true, // keep 5173 so the .replit [[ports]] 5173 -> 80 mapping holds
    // Accept the proxied Host header from Replit. Without this, Vite 5.4+ answers
    // "Blocked request. This host (...) is not allowed." for *.replit.dev hosts.
    allowedHosts: true,
    // If live-reload won't connect through the proxy, uncomment:
    // hmr: { clientPort: 443 },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
})
