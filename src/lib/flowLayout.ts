import type { WorkflowStep } from '../types/workflow'

export const FLOW_NODE_WIDTH = 220
export const FLOW_NODE_HEIGHT = 112
export const FLOW_ENTRY_NODE_ID = '__entry__'

export type FlowNodeLayout = {
  x: number
  y: number
  collapsed?: boolean
}

export type FlowCanvasLayout = {
  nodes: Record<string, FlowNodeLayout>
}

export function isConditionalStep(value?: string): boolean {
  if (!value) return false
  return /if|when|fail|error|success|失敗|成功|條件|找不到|同意|不同意|超時/i.test(value)
}

export function defaultFlowLayout(steps: WorkflowStep[]): FlowCanvasLayout {
  const nodes: Record<string, FlowNodeLayout> = {}
  const startX = 310
  const startY = 238
  const gapX = 270
  const branchOffset = 122

  steps.forEach((step, index) => {
    const lane = isConditionalStep(step.when) ? (index % 2 === 0 ? -1 : 1) : 0
    nodes[step.id] = {
      x: startX + index * gapX,
      y: startY + lane * branchOffset,
    }
  })

  return { nodes }
}

export function mergeLayoutWithSteps(layout: FlowCanvasLayout, steps: WorkflowStep[]): FlowCanvasLayout {
  const defaults = defaultFlowLayout(steps)
  const nextNodes: Record<string, FlowNodeLayout> = {}

  for (const step of steps) {
    nextNodes[step.id] = {
      ...defaults.nodes[step.id],
      ...layout.nodes[step.id],
    }
  }

  return { nodes: nextNodes }
}

export function flowCanvasSize(steps: WorkflowStep[], layout: FlowCanvasLayout): { width: number; height: number } {
  const nodes = steps.map((step) => layout.nodes[step.id]).filter(Boolean)
  const maxX = Math.max(860, ...nodes.map((node) => node.x + FLOW_NODE_WIDTH + 220))
  const maxY = Math.max(620, ...nodes.map((node) => node.y + FLOW_NODE_HEIGHT + 180))
  return { width: maxX, height: maxY }
}
