import { describe, expect, it } from 'vitest'

import config from './vite.config'

describe('vite build configuration', () => {
  it('splits large third-party dependencies into stable vendor chunks', () => {
    const manualChunks = config.build?.rollupOptions?.output?.manualChunks

    expect(typeof manualChunks).toBe('function')
    expect(manualChunks?.('D:/project/node_modules/react/index.js')).toBe('react-vendor')
    expect(manualChunks?.('D:/project/node_modules/react-dom/client.js')).toBe('react-vendor')
    expect(manualChunks?.('D:/project/node_modules/@xyflow/react/dist/esm/index.js')).toBe('xyflow')
    expect(manualChunks?.('D:/project/node_modules/lucide-react/dist/esm/icons/sun.js')).toBe('icons')
    expect(manualChunks?.('D:/project/node_modules/yaml/browser/index.js')).toBe('yaml')
  })

  it('does not proxy API requests when the app has no backend service', () => {
    expect(config.server?.proxy).toBeUndefined()
  })
})
