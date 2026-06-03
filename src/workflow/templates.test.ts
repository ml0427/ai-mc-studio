import { describe, expect, it } from 'vitest'

import { nodeTemplateMetadata, toolboxGroups } from './templates'
import type { WorkflowNodeKind } from './types'

const supportedKinds: WorkflowNodeKind[] = [
  'start',
  'ai_task',
  'condition',
  'human_check',
  'output',
  'shell',
  'tool',
  'file',
  'code_edit',
  'terminal',
]

describe('workflow templates', () => {
  it('defines metadata for every supported node kind', () => {
    expect(nodeTemplateMetadata.map((template) => template.kind)).toEqual(supportedKinds)
  })

  it('exposes every supported node kind in the toolbox groups once', () => {
    const groupedKinds = toolboxGroups.flatMap((group) => group.kinds)

    expect(groupedKinds).toEqual(supportedKinds)
    expect(new Set(groupedKinds).size).toBe(supportedKinds.length)
  })
})
