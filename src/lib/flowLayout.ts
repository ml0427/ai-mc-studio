import type { WorkflowStep } from '../types/workflow'

export const FLOW_NODE_WIDTH = 220
export const FLOW_NODE_HEIGHT = 112
export const FLOW_ENTRY_NODE_ID = '__entry__'
export const FLOW_MAIN_X = 360
export const FLOW_ENTRY_Y = 48
export const FLOW_FIRST_STEP_Y = 220
export const FLOW_VERTICAL_GAP = 172
export const FLOW_BRANCH_OFFSET = 292
export const FLOW_LAYOUT_VERSION = 2

export type FlowPortSide = 'top' | 'right' | 'bottom' | 'left'

export type FlowNodeLayout = {
  x: number
  y: number
  collapsed?: boolean
}

export type FlowCanvasLayout = {
  version?: number
  nodes: Record<string, FlowNodeLayout>
}

export function isConditionalStep(value?: string): boolean {
  if (!value) return false
  return /if|when|fail|error|success|失敗|成功|條件|找不到|同意|不同意|超時/i.test(value)
}

export function defaultFlowLayout(steps: WorkflowStep[]): FlowCanvasLayout {
  const nodes: Record<string, FlowNodeLayout> = {}
  let branchIndex = 0

  steps.forEach((step, index) => {
    const lane = isConditionalStep(step.when) ? (branchIndex % 2 === 0 ? 1 : -1) : 0
    if (lane !== 0) branchIndex += 1
    nodes[step.id] = {
      x: FLOW_MAIN_X + lane * FLOW_BRANCH_OFFSET,
      y: FLOW_FIRST_STEP_Y + index * FLOW_VERTICAL_GAP,
    }
  })

  return { version: FLOW_LAYOUT_VERSION, nodes }
}

export function mergeLayoutWithSteps(layout: FlowCanvasLayout, steps: WorkflowStep[]): FlowCanvasLayout {
  const defaults = defaultFlowLayout(steps)
  const nextNodes: Record<string, FlowNodeLayout> = {}
  const usableLayout = layout.version === FLOW_LAYOUT_VERSION ? layout : { nodes: {} }

  for (const step of steps) {
    nextNodes[step.id] = {
      ...defaults.nodes[step.id],
      ...usableLayout.nodes[step.id],
    }
  }

  return { version: FLOW_LAYOUT_VERSION, nodes: nextNodes }
}

export function flowCanvasSize(steps: WorkflowStep[], layout: FlowCanvasLayout): { width: number; height: number } {
  const nodes = steps.map((step) => layout.nodes[step.id]).filter(Boolean)
  const maxX = Math.max(860, ...nodes.map((node) => node.x + FLOW_NODE_WIDTH + 220))
  const maxY = Math.max(620, ...nodes.map((node) => node.y + FLOW_NODE_HEIGHT + 180))
  return { width: maxX, height: maxY }
}

export function flowPortPoint(node: FlowNodeLayout, side: FlowPortSide): { x: number; y: number } {
  if (side === 'top') return { x: node.x + FLOW_NODE_WIDTH / 2, y: node.y }
  if (side === 'right') return { x: node.x + FLOW_NODE_WIDTH, y: node.y + FLOW_NODE_HEIGHT / 2 }
  if (side === 'bottom') return { x: node.x + FLOW_NODE_WIDTH / 2, y: node.y + FLOW_NODE_HEIGHT }
  return { x: node.x, y: node.y + FLOW_NODE_HEIGHT / 2 }
}
