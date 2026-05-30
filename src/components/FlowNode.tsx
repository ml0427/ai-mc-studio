import { ChevronDown, ChevronRight, Grip, Waypoints } from 'lucide-react'
import { stepTypeMeta } from '../data/stepTemplates'
import { FLOW_NODE_HEIGHT, FLOW_NODE_WIDTH, type FlowNodeLayout, type FlowPortSide } from '../lib/flowLayout'
import type { WorkflowStep } from '../types/workflow'

const flowPorts: { side: FlowPortSide; label: string }[] = [
  { side: 'top', label: '上方連線點' },
  { side: 'right', label: '右側連線點' },
  { side: 'bottom', label: '下方連線點' },
  { side: 'left', label: '左側連線點' },
]

export function FlowNode({
  step,
  index,
  canCollapseDownstream,
  downstreamHiddenCount,
  layout,
  selected,
  onSelect,
  onStartConnector,
  onStartDrag,
  onToggleCollapsed,
}: {
  step: WorkflowStep
  index: number
  canCollapseDownstream: boolean
  downstreamHiddenCount: number
  layout: FlowNodeLayout
  selected: boolean
  onSelect: (stepId: string) => void
  onStartConnector: (stepId: string, side: FlowPortSide, clientX: number, clientY: number) => void
  onStartDrag: (stepId: string, clientX: number, clientY: number) => void
  onToggleCollapsed: (stepId: string) => void
}) {
  const meta = stepTypeMeta(step.type)
  const collapsed = Boolean(layout.collapsed)

  return (
    <article
      className={[
        'flow-node',
        meta.className,
        selected ? 'selected' : '',
        collapsed ? 'collapsed' : '',
      ].filter(Boolean).join(' ')}
      role="button"
      style={{
        left: layout.x,
        top: layout.y,
        width: FLOW_NODE_WIDTH,
        minHeight: FLOW_NODE_HEIGHT,
      }}
      tabIndex={0}
      onClick={() => onSelect(step.id)}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        if ((event.target as HTMLElement).closest('button')) return
        onStartDrag(step.id, event.clientX, event.clientY)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(step.id)
        }
      }}
    >
      {flowPorts.map((port) => (
        <button
          aria-label={port.label}
          className={`flow-port ${port.side}`}
          key={port.side}
          tabIndex={-1}
          title={port.label}
          type="button"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            event.stopPropagation()
            onStartConnector(step.id, port.side, event.clientX, event.clientY)
          }}
        />
      ))}
      <div className="flow-node-top">
        <span className="flow-node-index">{index + 1}</span>
        <strong>{step.id}</strong>
        <Grip size={14} />
      </div>
      <div className="flow-node-kind">
        <Waypoints size={14} />
        {meta.label}
      </div>
      <dl className="flow-node-facts">
        <div>
          <dt>條件/提示</dt>
          <dd>{step.when || '接著做'}</dd>
        </div>
        <div>
          <dt>成果</dt>
          <dd>{step.output || '未命名'}</dd>
        </div>
      </dl>
      {collapsed && (
        <div className="flow-node-folded">後面已收合 {downstreamHiddenCount} 塊</div>
      )}
      <button
        aria-label={collapsed ? '展開後續流程' : '收合後續流程'}
        className="flow-node-arrow"
        disabled={!canCollapseDownstream}
        type="button"
        title={collapsed ? '展開後續流程' : '收合後續流程'}
        onClick={(event) => {
          event.stopPropagation()
          onToggleCollapsed(step.id)
        }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
    </article>
  )
}
