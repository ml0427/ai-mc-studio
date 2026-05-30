import { Box } from 'lucide-react'
import { STEP_TEMPLATES, stepTypeMeta } from '../data/stepTemplates'
import type { StepTemplate } from '../types/workflow'

export function BlockToolbox({ onAddStep }: { onAddStep: (template: StepTemplate) => void }) {
  return (
    <section className="toolbox-section" aria-label="積木工具箱">
      <div className="panel-title">
        <Box size={16} />
        積木工具箱
      </div>
      <div className="toolbox-list">
        {STEP_TEMPLATES.map((template) => {
          const meta = stepTypeMeta(template.type)
          return (
            <button
              className={`toolbox-block ${meta.className}`}
              draggable
              key={template.type}
              type="button"
              onClick={() => onAddStep(template)}
              onDragStart={(event) => {
                event.dataTransfer.setData('application/x-step-type', template.type)
                event.dataTransfer.effectAllowed = 'copy'
              }}
            >
              <strong>{template.label}</strong>
              <span>{template.hint}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
