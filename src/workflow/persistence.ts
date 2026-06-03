import type { PreviewMode, ThemeMode, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from './types'

export const canvasStorageKey = 'ai-mc-studio:canvas-state:v1'

export type PersistedCanvasState = {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedWorkflowName: string
  previewMode: PreviewMode
  themeMode: ThemeMode
}

const workflowNodeKinds: WorkflowNodeKind[] = [
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

const previewModes: PreviewMode[] = ['aiMc', 'graph', 'canvas']
const themeModes: ThemeMode[] = ['dark', 'light']

export function createCanvasBackup(state: PersistedCanvasState) {
  return JSON.stringify({
    version: 1,
    nodes: state.nodes.map(toPersistedNode),
    edges: state.edges.map(toPersistedEdge),
    selectedWorkflowName: state.selectedWorkflowName,
    previewMode: state.previewMode,
    themeMode: state.themeMode,
  }, null, 2)
}

export function parseCanvasBackup(value: string): PersistedCanvasState | null {
  try {
    return normalizeCanvasState(JSON.parse(value))
  } catch {
    return null
  }
}

export function readCanvasStateFromStorage(storage: Storage | null | undefined): PersistedCanvasState | null {
  if (!storage) return null
  try {
    const stored = storage.getItem(canvasStorageKey)
    return stored ? parseCanvasBackup(stored) : null
  } catch {
    return null
  }
}

export function writeCanvasStateToStorage(storage: Storage | null | undefined, state: PersistedCanvasState) {
  if (!storage) return false
  try {
    storage.setItem(canvasStorageKey, createCanvasBackup(state))
    return true
  } catch {
    return false
  }
}

export function removeCanvasStateFromStorage(storage: Storage | null | undefined) {
  if (!storage) return false
  try {
    storage.removeItem(canvasStorageKey)
    return true
  } catch {
    return false
  }
}

function normalizeCanvasState(value: unknown): PersistedCanvasState | null {
  if (!isRecord(value)) return null
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null
  const parsedNodes = value.nodes.map(normalizeNode)
  if (parsedNodes.some((node) => !node)) return null
  const nodes = parsedNodes.filter(isPresent)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const parsedEdges = value.edges.map(normalizeEdge)
  if (parsedEdges.some((edge) => !edge)) return null
  const edges = parsedEdges.filter(isPresent)
  if (edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) return null

  return {
    nodes,
    edges,
    selectedWorkflowName: typeof value.selectedWorkflowName === 'string' ? value.selectedWorkflowName : '',
    previewMode: isPreviewMode(value.previewMode) ? value.previewMode : 'aiMc',
    themeMode: isThemeMode(value.themeMode) ? value.themeMode : 'dark',
  }
}

function normalizeNode(value: unknown): WorkflowNode | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.data)) return null
  const kind = value.data.kind
  if (!isWorkflowNodeKind(kind)) return null

  return {
    id: value.id,
    type: 'workflowNode',
    position: normalizePosition(value.position),
    data: {
      kind,
      title: stringValue(value.data.title),
      description: stringValue(value.data.description),
      purpose: stringValue(value.data.purpose),
      instructions: stringValue(value.data.instructions),
      decisionRules: stringValue(value.data.decisionRules),
      input: stringValue(value.data.input),
      output: stringValue(value.data.output),
      branchHandles: normalizeBranchHandles(value.data.branchHandles),
    },
  }
}

function normalizeEdge(value: unknown): WorkflowEdge | null {
  if (!isRecord(value) || typeof value.source !== 'string' || typeof value.target !== 'string') return null
  const id = typeof value.id === 'string' ? value.id : `${value.source}->${value.target}`

  return {
    id,
    source: value.source,
    target: value.target,
    sourceHandle: typeof value.sourceHandle === 'string' ? value.sourceHandle : null,
    targetHandle: typeof value.targetHandle === 'string' ? value.targetHandle : null,
    label: typeof value.label === 'string' ? value.label : undefined,
    data: isRecord(value.data) ? value.data : undefined,
    markerEnd: isRecord(value.markerEnd) ? value.markerEnd as WorkflowEdge['markerEnd'] : undefined,
    reconnectable: typeof value.reconnectable === 'boolean' ? value.reconnectable : undefined,
  }
}

function toPersistedNode(node: WorkflowNode) {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  }
}

function toPersistedEdge(edge: WorkflowEdge) {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle,
    label: edge.label,
    data: edge.data,
    markerEnd: edge.markerEnd,
    reconnectable: edge.reconnectable,
  }
}

function normalizePosition(value: unknown) {
  if (!isRecord(value)) return { x: 0, y: 0 }
  return {
    x: typeof value.x === 'number' ? value.x : 0,
    y: typeof value.y === 'number' ? value.y : 0,
  }
}

function normalizeBranchHandles(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const handles = value
    .map((handle) => {
      if (!isRecord(handle) || typeof handle.id !== 'string') return null
      return {
        id: handle.id,
        label: typeof handle.label === 'string' ? handle.label : handle.id,
      }
    })
    .filter(isPresent)
  return handles.length ? handles : undefined
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function isWorkflowNodeKind(value: unknown): value is WorkflowNodeKind {
  return typeof value === 'string' && workflowNodeKinds.includes(value as WorkflowNodeKind)
}

function isPreviewMode(value: unknown): value is PreviewMode {
  return typeof value === 'string' && previewModes.includes(value as PreviewMode)
}

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && themeModes.includes(value as ThemeMode)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null
}
