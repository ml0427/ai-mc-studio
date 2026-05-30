import { ArrowLeft, ArrowRight, Box, Copy, GripVertical, Trash2 } from 'lucide-react'
import { stepTypeMeta } from '../data/stepTemplates'
import type { WorkflowStep } from '../types/workflow'

export function StageBlocks({
  steps,
  selectedStepId,
  onSelectStep,
  onReorderStep,
  onDuplicateStep,
  onDeleteStep,
}: {
  steps: WorkflowStep[]
  selectedStepId?: string
  onSelectStep: (stepId: string) => void
  onReorderStep: (fromIndex: number, toIndex: number) => void
  onDuplicateStep: (stepId: string) => void
  onDeleteStep: (stepId: string) => void
}) {
  return (
    <div className="stage-blocks" aria-label="舞台積木列">
      <div className="panel-title">
        <Box size={16} />
        積木列
      </div>
      {steps.length === 0 ? (
        <div className="mini-empty">把左邊的積木拖到舞台，或點一下積木加入流程。</div>
      ) : (
        <div className="stage-block-row">
          {steps.map((step, index) => {
            const meta = stepTypeMeta(step.type)
            return (
              <div
                className={`stage-block ${meta.className} ${step.id === selectedStepId ? 'active' : ''}`}
                draggable
                key={step.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectStep(step.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectStep(step.id)
                  }
                }}
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/x-stage-step-index', String(index))
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const fromIndex = Number(event.dataTransfer.getData('application/x-stage-step-index'))
                  if (Number.isInteger(fromIndex)) onReorderStep(fromIndex, index)
                }}
              >
                <small>{index + 1}</small>
                <strong>{step.id}</strong>
                <span>{meta.label}</span>
                <div className="stage-block-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" title="拖曳這塊可以換順序">
                    <GripVertical size={13} />
                  </button>
                  <button
                    type="button"
                    title="往前移"
                    onClick={() => onReorderStep(index, index - 1)}
                    disabled={index === 0}
                  >
                    <ArrowLeft size={13} />
                  </button>
                  <button
                    type="button"
                    title="往後移"
                    onClick={() => onReorderStep(index, index + 1)}
                    disabled={index === steps.length - 1}
                  >
                    <ArrowRight size={13} />
                  </button>
                  <button type="button" title="複製積木" onClick={() => onDuplicateStep(step.id)}>
                    <Copy size={13} />
                  </button>
                  <button type="button" title="刪除積木" onClick={() => onDeleteStep(step.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
