import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// PWA plugin is added by the UI/PWA agent.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
