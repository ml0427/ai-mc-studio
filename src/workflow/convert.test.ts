import { describe, expect, it } from 'vitest'

import { toAiMcWorkflowSpec, toGraphWorkflowSpec } from './convert'
import type { WorkflowEdge, WorkflowNode, WorkflowNodeKind } from './types'

function workflowNode(id: string, kind: WorkflowNodeKind, y: number): WorkflowNode {
  return {
    id,
    type: 'workflowNode',
    position: { x: 100, y },
    data: {
      kind,
      title: id,
      description: '',
      purpose: '',
      instructions: '',
      decisionRules: '',
      input: '',
      output: id,
      branchHandles: kind === 'condition'
        ? [{ id: 'needs-review', label: '需要人工複核' }]
        : undefined,
    },
  }
}

function workflowEdge(source: string, target: string, sourceHandle = 'bottom', label?: string): WorkflowEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    sourceHandle,
    targetHandle: 'top',
    label,
  }
}

describe('workflow converters', () => {
  it('orders ai-mc steps from graph traversal and excludes start nodes', () => {
    const nodes = [
      workflowNode('second', 'ai_task', 300),
      workflowNode('start-1', 'start', 0),
      workflowNode('first', 'shell', 150),
    ]
    const edges = [
      workflowEdge('start-1', 'first'),
      workflowEdge('first', 'second'),
    ]

    const spec = toAiMcWorkflowSpec(nodes, edges)

    expect(spec.workflows?.main.steps?.map((step) => step.id)).toEqual(['first', 'second'])
    expect(spec.workflows?.main.steps?.map((step) => step.type)).toEqual(['shell', 'ai'])
  })

  it('includes graph nodes, edges, and condition handles', () => {
    const nodes = [
      workflowNode('start-1', 'start', 0),
      workflowNode('decide', 'condition', 100),
      workflowNode('review', 'ai_task', 200),
    ]
    const edges = [
      workflowEdge('start-1', 'decide'),
      workflowEdge('decide', 'review', 'needs-review', '需要人工複核'),
    ]

    const spec = toGraphWorkflowSpec(nodes, edges)
    const graph = spec.workflows.main.graph

    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'decide', kind: 'condition', handles: [{ id: 'needs-review', label: '需要人工複核' }] }),
    ]))
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'decide', to: 'review', sourceHandle: 'needs-review', targetHandle: 'top', label: '需要人工複核' }),
    ]))
  })
})
