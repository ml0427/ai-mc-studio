import { MarkerType } from '@xyflow/react'

import type { BranchHandle, WorkflowEdge, WorkflowNodeKind } from './types'
import { sanitizeStepId } from './utils'

export const defaultEdgeOptions = {
  animated: true,
  reconnectable: true,
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    color: 'var(--flow-edge)',
  },
  style: {
    stroke: 'var(--flow-edge)',
    strokeWidth: 2.5,
  },
} satisfies Partial<WorkflowEdge>

export function sanitizeHandleId(value: string) {
  return sanitizeStepId(value || 'branch')
}

export function canonicalConditionHandleId(value: string | undefined | null) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'yes' || normalized === '是') return 'yes'
  if (normalized === 'no' || normalized === '否') return 'no'
  return sanitizeHandleId(String(value ?? 'branch'))
}

export function branchLabelForHandle(sourceHandle?: string | null, branchHandles: BranchHandle[] = []) {
  if (!sourceHandle) return undefined
  const customLabel = branchHandles.find((handle) => handle.id === sourceHandle)?.label
  if (customLabel) return customLabel
  if (sourceHandle === 'yes') return '是'
  if (sourceHandle === 'no') return '否'
  return undefined
}

export function localizedBranchLabel(branch: string | undefined) {
  if (!branch) return undefined
  if (branch === 'yes') return '是'
  if (branch === 'no') return '否'
  if (branch === 'pass') return '通過'
  if (branch === 'loop') return '回圈'
  return branch
}

export function makeWorkflowEdge(
  source: string,
  target: string,
  sourceKind?: WorkflowNodeKind,
  options: {
    id?: string
    sourceHandle?: string
    targetHandle?: string
    label?: string
    showLabel?: boolean
    sourceBranchHandles?: BranchHandle[]
  } = {},
): WorkflowEdge {
  const sourceHandle = options.sourceHandle ?? (sourceKind === 'condition' ? 'yes' : 'bottom')
  const targetHandle = options.targetHandle ?? 'top'
  const displayLabel = options.showLabel === false ? undefined : options.label
  return {
    ...edgeOptionsForConnection(sourceKind, sourceHandle, displayLabel, options.sourceBranchHandles),
    id: options.id ?? `${source}:${sourceHandle}->${target}:${targetHandle}`,
    source,
    sourceHandle,
    target,
    targetHandle,
    data: options.label ? { label: options.label } : undefined,
  }
}

export function edgeOptionsForConnection(
  sourceKind?: WorkflowNodeKind,
  sourceHandle?: string | null,
  explicitLabel?: string,
  branchHandles: BranchHandle[] = [],
): Partial<WorkflowEdge> {
  const label = explicitLabel ?? (sourceKind === 'condition' ? branchLabelForHandle(sourceHandle, branchHandles) : undefined)
  if (!label) return defaultEdgeOptions
  return {
    ...defaultEdgeOptions,
    label,
    labelStyle: {
      fill: 'var(--flow-label-text)',
      fontSize: 12,
      fontWeight: 900,
    },
    labelBgStyle: {
      fill: 'var(--flow-label-bg)',
      fillOpacity: 1,
    },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 999,
  }
}

export function edgeLabel(edge: WorkflowEdge) {
  if (typeof edge.label === 'string') return edge.label
  if (edge.data && typeof edge.data === 'object' && 'label' in edge.data && typeof edge.data.label === 'string') {
    return edge.data.label
  }
  return undefined
}
