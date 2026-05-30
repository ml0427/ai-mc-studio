import {
  FLOW_ENTRY_NODE_ID,
  FLOW_NODE_HEIGHT,
  FLOW_NODE_WIDTH,
  isConditionalStep,
  type FlowCanvasLayout,
  type FlowNodeLayout,
} from '../lib/flowLayout'
import type { WorkflowStep } from '../types/workflow'

const entryNode: FlowNodeLayout = { x: 42, y: 238 }

export function FlowEdges({
  steps,
  layout,
}: {
  steps: WorkflowStep[]
  layout: FlowCanvasLayout
}) {
  const nodeMap: Record<string, FlowNodeLayout> = {
    [FLOW_ENTRY_NODE_ID]: entryNode,
    ...layout.nodes,
  }
  const edges = steps.map((step, index) => ({
    from: index === 0 ? FLOW_ENTRY_NODE_ID : steps[index - 1].id,
    to: step.id,
    label: isConditionalStep(step.when) ? '條件' : '',
    branch: isConditionalStep(step.when),
  }))

  return (
    <svg className="flow-edges" aria-hidden="true">
      <defs>
        <marker id="flow-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
          <path d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const from = nodeMap[edge.from]
        const to = nodeMap[edge.to]
        if (!from || !to) return null

        const startX = from.x + FLOW_NODE_WIDTH
        const startY = from.y + FLOW_NODE_HEIGHT / 2
        const endX = to.x
        const endY = to.y + FLOW_NODE_HEIGHT / 2
        const mid = Math.max(60, Math.abs(endX - startX) / 2)
        const path = `M ${startX} ${startY} C ${startX + mid} ${startY}, ${endX - mid} ${endY}, ${endX} ${endY}`
        const labelX = (startX + endX) / 2
        const labelY = (startY + endY) / 2 - 10

        return (
          <g className={`flow-edge ${edge.branch ? 'branch' : ''}`} key={`${edge.from}-${edge.to}`}>
            <path d={path} markerEnd="url(#flow-arrow)" />
            {edge.label && (
              <text x={labelX} y={labelY}>{edge.label}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
