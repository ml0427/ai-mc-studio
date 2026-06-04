import { describe, expect, it } from 'vitest'

import {
  addBranchHandle,
  deleteCanvasSelection,
  duplicateNode,
  layoutWorkflowCanvas,
  removeBranchHandle,
  renameBranchHandle,
} from './canvasEditing'
import type { WorkflowEdge, WorkflowNode } from './types'

function node(id: string, x = 0, y = 0, kind: WorkflowNode['data']['kind'] = 'ai_task'): WorkflowNode {
  return {
    id,
    type: 'workflowNode',
    position: { x, y },
    data: {
      kind,
      title: id,
      description: '',
      purpose: '',
      instructions: '',
      decisionRules: '',
      input: '',
      output: id,
      branchHandles: kind === 'condition' ? [{ id: 'yes', label: '是' }, { id: 'no', label: '否' }] : undefined,
    },
  }
}

function edge(id: string, source: string, target: string, sourceHandle?: string): WorkflowEdge {
  return {
    id,
    source,
    target,
    sourceHandle,
    label: sourceHandle,
  }
}

describe('canvas editing helpers', () => {
  it('deletes a selected node and its connected edges', () => {
    const result = deleteCanvasSelection(
      [node('start'), node('middle'), node('end')],
      [edge('a', 'start', 'middle'), edge('b', 'middle', 'end')],
      { nodeId: 'middle' },
    )

    expect(result.nodes.map((item) => item.id)).toEqual(['start', 'end'])
    expect(result.edges).toEqual([])
  })

  it('deletes a selected edge without removing nodes', () => {
    const result = deleteCanvasSelection(
      [node('start'), node('end')],
      [edge('a', 'start', 'end')],
      { edgeId: 'a' },
    )

    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toEqual([])
  })

  it('duplicates a node with a unique id and offset position', () => {
    const result = duplicateNode([node('task', 20, 30)], 'task')

    expect(result?.node.id).toBe('task-copy-1')
    expect(result?.node.position).toEqual({ x: 80, y: 90 })
    expect(result?.nodes.map((item) => item.id)).toEqual(['task', 'task-copy-1'])
  })

  it('adds, renames, and removes condition branch handles while keeping edge labels in sync', () => {
    const condition = node('condition', 0, 0, 'condition')
    const target = node('target')
    const added = addBranchHandle([condition, target], 'condition')
    const branchId = added.nodes[0].data.branchHandles?.at(-1)?.id ?? ''

    expect(branchId).toBe('branch-1')

    const renamed = renameBranchHandle(added.nodes, [edge('route', 'condition', 'target', branchId)], 'condition', branchId, '人工')

    expect(renamed.nodes[0].data.branchHandles?.find((handle) => handle.id === branchId)?.label).toBe('人工')
    expect(renamed.edges[0].label).toBe('人工')

    const removed = removeBranchHandle(renamed.nodes, renamed.edges, 'condition', branchId)

    expect(removed.nodes[0].data.branchHandles?.some((handle) => handle.id === branchId)).toBe(false)
    expect(removed.edges).toEqual([])
  })

  it('lays out workflow nodes based on current edges', () => {
    const result = layoutWorkflowCanvas(
      [node('start', 0, 0), node('middle', 0, 0), node('end', 0, 0)],
      [edge('a', 'start', 'middle'), edge('b', 'middle', 'end')],
    )

    expect(result.map((item) => item.position.y)).toEqual([80, 330, 580])
  })
})
