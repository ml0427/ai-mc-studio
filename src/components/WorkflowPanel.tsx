import { GitBranch } from 'lucide-react'
import { countLabel } from '../lib/format'
import type { ProjectDetail, StepTemplate } from '../types/workflow'
import { BlockToolbox } from './BlockToolbox'

export function WorkflowPanel({
  project,
  selectedWorkflow,
  onSelectWorkflow,
  onAddStep,
}: {
  project: ProjectDetail | null
  selectedWorkflow: string
  onSelectWorkflow: (workflowName: string) => void
  onAddStep: (template: StepTemplate) => void
}) {
  return (
    <nav className="workflow-panel block-toolbox" aria-label="流程和積木工具箱">
      <div className="panel-title">
        <GitBranch size={16} />
        流程
      </div>
      {project?.workflows.map((item) => (
        <button
          className={`workflow-row ${item.name === selectedWorkflow ? 'active' : ''}`}
          key={item.name}
          type="button"
          onClick={() => onSelectWorkflow(item.name)}
        >
          <strong>{item.name}</strong>
          <span>{countLabel(item.stepCount, '個步驟')} · {countLabel(item.gateCount, '個檢查點')}</span>
        </button>
      ))}
      <BlockToolbox onAddStep={onAddStep} />
    </nav>
  )
}
