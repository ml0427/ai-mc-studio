import { describe, expect, it } from 'vitest'

import { parseAiMcWorkflow, workflowNamesFromText } from './parse'

describe('workflow parser', () => {
  it('reads workflow names from YAML text', () => {
    const names = workflowNamesFromText(`
workflows:
  main:
    steps: []
  release-check:
    steps: []
`)

    expect(names).toEqual(['main', 'release-check'])
  })

  it('imports graph workflows with condition kind and custom branch labels/handles', () => {
    const parsed = parseAiMcWorkflow(`
workflows:
  main:
    steps:
      - id: decide
        type: ai
        when: needs review?
      - id: approve
        type: ai
      - id: reject
        type: ai
    graph:
      nodes:
        - id: start
          kind: start
          title: Start
        - id: decide
          kind: condition
          title: Decide
        - id: approve
          kind: ai_task
          title: Approve
        - id: reject
          kind: ai_task
          title: Reject
      edges:
        - from: start
          to: decide
        - from: decide
          to: approve
          branch: yes
        - from: decide
          to: reject
          handle: needs-review
          branch_label: 需要人工複核
`)

    const condition = parsed.nodes.find((node) => node.id === 'decide')
    const reviewEdge = parsed.edges.find((edge) => edge.source === 'decide' && edge.target === 'reject')

    expect(condition?.data.kind).toBe('condition')
    expect(condition?.data.branchHandles).toEqual([
      { id: 'yes', label: '是' },
      { id: 'needs-review', label: '需要人工複核' },
    ])
    expect(reviewEdge?.sourceHandle).toBe('needs-review')
    expect(reviewEdge?.label).toBe('需要人工複核')
  })
})
