import { layoutGraph } from './layout'
import type { AiMcGraphEdge, AiMcGraphNode, BranchHandle, WorkflowEdge, WorkflowNode } from './types'

type CanvasSelection = {
  edgeId?: string
  nodeId?: string
}

export function deleteCanvasSelection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  selection: CanvasSelection,
) {
  if (selection.edgeId) {
    return {
      nodes,
      edges: edges.filter((edge) => edge.id !== selection.edgeId),
    }
  }

  if (selection.nodeId) {
    return {
      nodes: nodes.filter((node) => node.id !== selection.nodeId),
      edges: edges.filter((edge) => edge.source !== selection.nodeId && edge.target !== selection.nodeId),
    }
  }

  return { nodes, edges }
}

export function duplicateNode(nodes: WorkflowNode[], nodeId: string, offset = 60) {
  const source = nodes.find((node) => node.id === nodeId)
  if (!source) return null

  const id = nextCopyId(nodes, nodeId)
  const node: WorkflowNode = {
    ...source,
    id,
    selected: true,
    position: {
      x: source.position.x + offset,
      y: source.position.y + offset,
    },
    data: {
      ...source.data,
      title: `${source.data.title} 複本`,
      output: source.data.output === source.id ? id : source.data.output,
      branchHandles: source.data.branchHandles?.map((handle) => ({ ...handle })),
    },
  }

  return {
    node,
    nodes: [...nodes.map((item) => ({ ...item, selected: false })), node],
  }
}

export function addBranchHandle(nodes: WorkflowNode[], nodeId: string) {
  let addedNode: WorkflowNode | null = null
  const nextNodes = nodes.map((node) => {
    if (node.id !== nodeId || node.data.kind !== 'condition') return node
    const handles = node.data.branchHandles ?? []
    const id = nextBranchId(handles)
    const nextNode = {
      ...node,
      data: {
        ...node.data,
        branchHandles: [...handles, { id, label: `分支 ${handles.length + 1}` }],
      },
    }
    addedNode = nextNode
    return nextNode
  })

  return { node: addedNode, nodes: nextNodes }
}

export function renameBranchHandle(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeId: string,
  handleId: string,
  label: string,
) {
  const nextLabel = label.trim() || handleId
  return {
    nodes: nodes.map((node) => {
      if (node.id !== nodeId) return node
      return {
        ...node,
        data: {
          ...node.data,
          branchHandles: node.data.branchHandles?.map((handle) => (
            handle.id === handleId ? { ...handle, label: nextLabel } : handle
          )),
        },
      }
    }),
    edges: edges.map((edge) => (
      edge.source === nodeId && edge.sourceHandle === handleId
        ? { ...edge, label: nextLabel, data: { ...edge.data, branchLabel: nextLabel } }
        : edge
    )),
  }
}

export function removeBranchHandle(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeId: string,
  handleId: string,
) {
  return {
    nodes: nodes.map((node) => {
      if (node.id !== nodeId) return node
      return {
        ...node,
        data: {
          ...node.data,
          branchHandles: node.data.branchHandles?.filter((handle) => handle.id !== handleId),
        },
      }
    }),
    edges: edges.filter((edge) => !(edge.source === nodeId && edge.sourceHandle === handleId)),
  }
}

export function layoutWorkflowCanvas(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const graphNodes: AiMcGraphNode[] = nodes.map((node) => ({
    id: node.id,
    kind: node.data.kind,
    title: node.data.title,
  }))
  const graphEdges: AiMcGraphEdge[] = edges.map((edge) => ({
    from: edge.source,
    to: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    label: typeof edge.label === 'string' ? edge.label : undefined,
  }))
  const positions = layoutGraph(graphNodes, graphEdges)

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }))
}

function nextCopyId(nodes: WorkflowNode[], baseId: string) {
  const usedIds = new Set(nodes.map((node) => node.id))
  for (let index = 1; ; index += 1) {
    const id = `${baseId}-copy-${index}`
    if (!usedIds.has(id)) return id
  }
}

function nextBranchId(handles: BranchHandle[]) {
  const usedIds = new Set(handles.map((handle) => handle.id))
  for (let index = 1; ; index += 1) {
    const id = `branch-${index}`
    if (!usedIds.has(id)) return id
  }
}
