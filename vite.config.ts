import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function vendorChunk(id: string) {
  const normalizedId = id.replaceAll('\\', '/')
  if (!normalizedId.includes('node_modules')) return undefined
  if (normalizedId.includes('/@xyflow/react/')) return 'xyflow'
  if (normalizedId.includes('/react/') || normalizedId.includes('/react-dom/')) return 'react-vendor'
  if (normalizedId.includes('/lucide-react/')) return 'icons'
  if (normalizedId.includes('/yaml/')) return 'yaml'
  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
})
