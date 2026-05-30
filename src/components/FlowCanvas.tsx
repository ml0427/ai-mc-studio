import { useRef, useState, type ReactNode } from 'react'
import { GitBranch, LayoutDashboard, MousePointer2, Workflow } from 'lucide-react'
import { useFlowCanvasLayout } from '../hooks/useFlowCanvasLayout'
import { FLOW_NODE_HEIGHT, FLOW_NODE_WIDTH, flowCanvasSize } from '../lib/flowLayout'
import type { ProjectDetail, StepTemplate, WorkflowStep } from '../types/workflow'
import { AiGuideDraft } from './AiGuideDraft'
import { EmptyState } from './EmptyState'
import { FlowEdges } from './FlowEdges'
import { FlowNode } from './FlowNode'

export function FlowCanvas({
  project,
  selectedWorkflow,
  selectedStepId,
  steps,
  loading,
  inspector,
  onSelectWorkflow,
  onSelectStep,
  onAddStep,
}: {
  project: ProjectDetail | null
  selectedWorkflow: string
  selectedStepId?: string
  steps: WorkflowStep[]
  loading: boolean
  inspector: ReactNode
  onSelectWorkflow: (workflowName: string) => void
  onSelectStep: (stepId: string) => void
  onAddStep: (template: StepTemplate, options?: { afterStepId?: string; when?: string }) => void
}) {
  const {
    layout,
    formatCanvas,
    setNodePosition,
    toggleCollapsed,
  } = useFlowCanvasLayout({
    projectId: project?.id,
    workflowName: selectedWorkflow,
    steps,
  })
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState<{ stepId: string; offsetX: number; offsetY: number } | null>(null)
  const canvasSize = flowCanvasSize(steps, layout)

  function startDrag(stepId: string, clientX: number, clientY: number) {
    const node = layout.nodes[stepId]
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!node || !rect) return
    setDragging({
      stepId,
      offsetX: clientX - rect.left - node.x,
      offsetY: clientY - rect.top - node.y,
    })
  }

  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    if (!dragging) return
    const rect = event.currentTarget.getBoundingClientRect()
    setNodePosition(
      dragging.stepId,
      event.clientX - rect.left - dragging.offsetX,
      event.clientY - rect.top - dragging.offsetY,
    )
  }

  return (
    <section className="flow-workspace" aria-label="可收合流程圖畫布">
      <div className="flow-canvas-header">
        <div>
          <span className="flow-kicker">可收合流程圖</span>
          <h2>右邊現在是一張畫布</h2>
          <p>線代表下一步，方塊可以拖曳、收合，也可以交給 AI 司儀先做草稿。</p>
        </div>
        <div className="flow-canvas-actions">
          <label>
            <GitBranch size={15} />
            <select value={selectedWorkflow} onChange={(event) => onSelectWorkflow(event.target.value)}>
              {project?.workflows.map((workflow) => (
                <option key={workflow.name} value={workflow.name}>
                  {workflow.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={formatCanvas}>
            <LayoutDashboard size={15} />
            整理畫布
          </button>
        </div>
      </div>

      <div className="flow-body">
        <div className="flow-canvas-shell">
          <div className="flow-legend">
            <span><i className="solid" />下一步</span>
            <span><i className="branch" />有條件</span>
            <span><MousePointer2 size={13} />拖曳方塊可調位置</span>
          </div>
          <div className="flow-scroll">
            <div
              className="flow-surface"
              ref={surfaceRef}
              style={{ width: canvasSize.width, height: canvasSize.height }}
              onPointerMove={moveDrag}
              onPointerUp={() => setDragging(null)}
              onPointerLeave={() => setDragging(null)}
            >
              <FlowEdges steps={steps} layout={layout} />
              <article
                className="flow-entry-node"
                style={{ left: 42, top: 238, width: FLOW_NODE_WIDTH, minHeight: FLOW_NODE_HEIGHT }}
              >
                <div className="flow-node-top">
                  <span className="flow-node-index">入口</span>
                  <strong>開始</strong>
                  <Workflow size={15} />
                </div>
                <p>所有流程都從這裡出發。</p>
              </article>
              {steps.length === 0 ? (
                <div className="flow-empty">
                  <EmptyState loading={loading} />
                </div>
              ) : steps.map((step, index) => (
                <FlowNode
                  index={index}
                  key={step.id}
                  layout={layout.nodes[step.id]}
                  selected={step.id === selectedStepId}
                  step={step}
                  onSelect={onSelectStep}
                  onStartDrag={startDrag}
                  onToggleCollapsed={toggleCollapsed}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="flow-sidecar">
          <AiGuideDraft steps={steps} onAddStep={onAddStep} />
          <div className="flow-inspector-dock">
            {inspector}
          </div>
        </aside>
      </div>
    </section>
  )
}
