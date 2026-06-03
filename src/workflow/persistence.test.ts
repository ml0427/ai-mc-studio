import { describe, expect, it } from 'vitest'

import {
  canvasStorageKey,
  createCanvasBackup,
  parseCanvasBackup,
  readCanvasStateFromStorage,
} from './persistence'
import type { PersistedCanvasState } from './persistence'

const canvasState: PersistedCanvasState = {
  nodes: [
    {
      id: 'start-1',
      type: 'workflowNode',
      position: { x: 10, y: 20 },
      data: {
        kind: 'start',
        title: '起點',
        description: '',
        purpose: '',
        instructions: '',
        decisionRules: '',
        input: '',
        output: 'start',
      },
    },
  ],
  edges: [],
  selectedWorkflowName: 'main',
  previewMode: 'graph',
  themeMode: 'light',
}

describe('canvas persistence', () => {
  it('round-trips canvas backup JSON', () => {
    const backup = createCanvasBackup(canvasState)
    const parsed = parseCanvasBackup(backup)

    expect(parsed?.nodes[0]?.id).toBe('start-1')
    expect(parsed?.selectedWorkflowName).toBe('main')
    expect(parsed?.previewMode).toBe('graph')
    expect(parsed?.themeMode).toBe('light')
  })

  it('rejects invalid backup data safely', () => {
    expect(parseCanvasBackup('not json')).toBeNull()
    expect(parseCanvasBackup(JSON.stringify({ nodes: [{ id: 'bad', data: { kind: 'unknown' } }] }))).toBeNull()
    expect(parseCanvasBackup(JSON.stringify({
      nodes: [],
      edges: [{ id: 'bad-edge', source: 'missing-a', target: 'missing-b' }],
    }))).toBeNull()
  })

  it('falls back when localStorage contains invalid data', () => {
    const storage = {
      getItem: (key: string) => (key === canvasStorageKey ? '{bad json' : null),
    } as Storage

    expect(readCanvasStateFromStorage(storage)).toBeNull()
  })
})
