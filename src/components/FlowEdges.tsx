import {
  FLOW_ENTRY_NODE_ID,
  FLOW_ENTRY_Y,
  FLOW_MAIN_X,
  isConditionalStep,
  flowPortPoint,
  type FlowCanvasLayout,
  type FlowNodeLayout,
  type FlowPortSide,
} from '../lib/flowLayout'
import type { WorkflowStep } from '../types/workflow'

const entryNode: FlowNodeLayout = { x: FLOW_MAIN_X, y: FLOW_ENTRY_Y }

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
        <marker id="flow-branch-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
          <path className="flow-branch-arrow" d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const from = nodeMap[edge.from]
        const to = nodeMap[edge.to]
        if (!from || !to) return null

        const sameLane = Math.abs(from.x - to.x) < 12
        const fromSide: FlowPortSide = sameLane ? 'bottom' : to.x > from.x ? 'right' : 'left'
        const toSide: FlowPortSide = sameLane ? 'top' : to.x > from.x ? 'left' : 'right'
        const start = flowPortPoint(from, fromSide)
        const end = flowPortPoint(to, toSide)
        const midY = (start.y + end.y) / 2
        const midX = (start.x + end.x) / 2
        const path = sameLane
          ? `M ${start.x} ${start.y} V ${midY} V ${end.y}`
          : `M ${start.x} ${start.y} H ${midX} V ${end.y} H ${end.x}`
        const labelX = sameLane ? start.x + 12 : midX + 10
        const labelY = sameLane ? midY - 8 : (start.y + end.y) / 2 - 8

        return (
          <g className={`flow-edge ${edge.branch ? 'branch' : ''}`} key={`${edge.from}-${edge.to}`}>
            <path d={path} markerEnd={edge.branch ? 'url(#flow-branch-arrow)' : 'url(#flow-arrow)'} />
            {edge.label && (
              <text x={labelX} y={labelY}>{edge.label}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
