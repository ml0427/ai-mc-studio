import { FileCode2 } from 'lucide-react'
import { stepTypeMeta } from '../data/stepTemplates'
import type { WorkflowDefinition, WorkflowStep } from '../types/workflow'
import { StepSpecificFields } from './StepSpecificFields'
import { SelectedStepSummary } from './StepSummary'

export function StepInspector({
  steps,
  selectedStep,
  workflow,
  error,
  onSelectStep,
  onUpdateStep,
  onPatchStep,
}: {
  steps: WorkflowStep[]
  selectedStep?: WorkflowStep
  workflow?: WorkflowDefinition | null
  error?: string
  onSelectStep: (stepId: string) => void
  onUpdateStep: (field: 'type' | 'when' | 'output', value: string) => void
  onPatchStep: (updater: (step: WorkflowStep) => void) => void
}) {
  return (
    <aside className="inspector-panel">
      <div className="panel-title">
        <FileCode2 size={16} />
        步驟設定
      </div>
      <div className="step-stack">
        {steps.map((step) => (
          <button
            className={`step-row ${step.id === selectedStep?.id ? 'active' : ''}`}
            key={step.id}
            type="button"
            onClick={() => onSelectStep(step.id)}
          >
            <span>{step.id}</span>
            <small>{stepTypeMeta(step.type).label}</small>
          </button>
        ))}
      </div>
      {selectedStep && (
        <div className="step-facts">
          <span>{stepTypeMeta(selectedStep.type).label}</span>
          {selectedStep.when && <span>條件</span>}
          {selectedStep.command_ref && <span>{selectedStep.command_ref}</span>}
          {selectedStep.output && <span>輸出：{selectedStep.output}</span>}
          {selectedStep.blocks_downstream && <span>會阻擋後續</span>}
        </div>
      )}
      {selectedStep && (
        <div className={`step-editor block-card ${stepTypeMeta(selectedStep.type).className}`}>
          <div className="block-card-header">
            <span>{stepTypeMeta(selectedStep.type).label}</span>
            <small>{stepTypeMeta(selectedStep.type).hint}</small>
          </div>
          <label>
            <span>這一步要做什麼</span>
            <select
              value={selectedStep.type}
              onChange={(event) => onUpdateStep('type', event.target.value)}
            >
              <option value="ai">{stepTypeMeta('ai').label} · ai</option>
              <option value="shell">{stepTypeMeta('shell').label} · shell</option>
              <option value="tool-or-shell">{stepTypeMeta('tool-or-shell').label} · tool-or-shell</option>
              <option value="tool-or-code-edit">{stepTypeMeta('tool-or-code-edit').label} · tool-or-code-edit</option>
              <option value="file">{stepTypeMeta('file').label} · file</option>
              <option value="code-edit">{stepTypeMeta('code-edit').label} · code-edit</option>
            </select>
          </label>
          <label>
            <span>什麼時候做</span>
            <input
              value={selectedStep.when ?? ''}
              onChange={(event) => onUpdateStep('when', event.target.value)}
              placeholder="always"
            />
          </label>
          <label>
            <span>完成後叫什麼名字</span>
            <input
              value={selectedStep.output ?? ''}
              onChange={(event) => onUpdateStep('output', event.target.value)}
              placeholder={selectedStep.id}
            />
          </label>
          <StepSpecificFields
            step={selectedStep}
            workflow={workflow}
            onPatchStep={onPatchStep}
          />
        </div>
      )}
      <SelectedStepSummary step={selectedStep} error={error ?? ''} />
    </aside>
  )
}
