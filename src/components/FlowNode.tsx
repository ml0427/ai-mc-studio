import { ChevronDown, ChevronRight, Grip, Waypoints } from 'lucide-react'
import { stepTypeMeta } from '../data/stepTemplates'
import { FLOW_NODE_HEIGHT, FLOW_NODE_WIDTH, type FlowNodeLayout } from '../lib/flowLayout'
import type { WorkflowStep } from '../types/workflow'

export function FlowNode({
  step,
  index,
  layout,
  selected,
  onSelect,
  onStartDrag,
  onToggleCollapsed,
}: {
  step: WorkflowStep
  index: number
  layout: FlowNodeLayout
  selected: boolean
  onSelect: (stepId: string) => void
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
        minHeight: collapsed ? 76 : FLOW_NODE_HEIGHT,
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
      <div className="flow-node-top">
        <span className="flow-node-index">{index + 1}</span>
        <strong>{step.id}</strong>
        <Grip size={14} />
      </div>
      <div className="flow-node-kind">
        <Waypoints size={14} />
        {meta.label}
      </div>
      {collapsed ? (
        <div className="flow-node-folded">已收合</div>
      ) : (
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
      )}
      <button
        className="flow-node-fold"
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggleCollapsed(step.id)
        }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        {collapsed ? '展開' : '收合'}
      </button>
    </article>
  )
}
