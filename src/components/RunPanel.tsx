import { History, RefreshCw, Workflow } from 'lucide-react'
import { formatDate, inputPlaceholder, statusLabel } from '../lib/format'
import type { ProjectDetail, WizardRunState, WizardRunSummary, WorkflowSummary } from '../types/workflow'
import { EmptyState } from './EmptyState'
import { MermaidChart } from './MermaidChart'
import { RunDetails } from './RunDetails'
import { RunStartConfirmCard } from './RunStartConfirmCard'
import { StepLegend } from './StepSummary'

export function RunPanel({
  project,
  selectedWorkflow,
  selectedWorkflowSummary,
  hasRunInputExamples,
  runInputValues,
  runs,
  selectedRunId,
  selectedRun,
  selectedRunState,
  runGraphSource,
  runStartConfirm,
  stageStepIds,
  loading,
  onFillRunInputExamples,
  onCancelRunStartConfirm,
  onConfirmStartRun,
  onUpdateRunInput,
  onRefreshRuns,
  onSelectRun,
  onSelectStep,
}: {
  project: ProjectDetail | null
  selectedWorkflow: string
  selectedWorkflowSummary?: WorkflowSummary
  hasRunInputExamples: boolean
  runInputValues: Record<string, string>
  runs: WizardRunSummary[]
  selectedRunId: string
  selectedRun?: WizardRunSummary
  selectedRunState: WizardRunState | null
  runGraphSource: string
  runStartConfirm: { missingInputs: string[]; outputs: string[]; stepCount: number } | null
  stageStepIds: string[]
  loading: boolean
  onFillRunInputExamples: () => void
  onCancelRunStartConfirm: () => void
  onConfirmStartRun: () => void
  onUpdateRunInput: (inputName: string, value: string) => void
  onRefreshRuns: () => void
  onSelectRun: (runId: string) => void
  onSelectStep: (stepId: string) => void
}) {
  return (
    <section className="run-panel">
      <div className="run-list">
        <div className="panel-title">
          <History size={16} />
          執行紀錄
          <button
            className="icon-action"
            type="button"
            onClick={onRefreshRuns}
            disabled={!project}
          >
            <RefreshCw size={14} />
            刷新
          </button>
        </div>
        {selectedWorkflowSummary && (
          <div className="run-inputs">
            <div className="run-input-title">
              <span>{selectedWorkflow} 的輸入欄位</span>
              {hasRunInputExamples && (
                <button type="button" onClick={onFillRunInputExamples}>套用範例</button>
              )}
            </div>
            {[
              ...selectedWorkflowSummary.requiredInputs.map((name) => ({ name, required: true })),
              ...selectedWorkflowSummary.optionalInputs.map((name) => ({ name, required: false })),
            ].map((input) => (
              <label key={input.name}>
                <span>{input.name}{input.required ? ' *' : ''}</span>
                <input
                  value={runInputValues[input.name] ?? ''}
                  onChange={(event) => onUpdateRunInput(input.name, event.target.value)}
                  placeholder={inputPlaceholder(input.name, input.required, selectedWorkflowSummary)}
                />
              </label>
            ))}
            {selectedWorkflowSummary.requiredInputs.length + selectedWorkflowSummary.optionalInputs.length === 0 && (
              <div className="mini-empty">這條流程沒有輸入欄位，可以直接開始執行。</div>
            )}
          </div>
        )}
        {runStartConfirm && (
          <RunStartConfirmCard
            missingInputs={runStartConfirm.missingInputs}
            outputs={runStartConfirm.outputs}
            stepCount={runStartConfirm.stepCount}
            onCancel={onCancelRunStartConfirm}
            onConfirm={onConfirmStartRun}
          />
        )}
        {runs.length === 0 ? (
          <div className="mini-empty">目前沒有執行紀錄，按「開始執行」。</div>
        ) : runs.map((run) => (
          <button
            className={`run-row ${run.runId === selectedRunId ? 'active' : ''}`}
            key={run.runId}
            type="button"
            onClick={() => onSelectRun(run.runId)}
          >
            <strong>{run.workflow}</strong>
            <span>{run.currentStep ?? statusLabel(run.status)}</span>
            <small>{run.completedCount + run.skippedCount}/{run.totalSteps} · {formatDate(run.updatedAt)}</small>
          </button>
        ))}
      </div>
      <div className="run-graph">
        <div className="panel-title">
          <Workflow size={16} />
          執行狀態
          {selectedRun && <span className="title-note">執行紀錄：{selectedRun.runId}</span>}
        </div>
        <StepLegend compact />
        {runGraphSource ? <MermaidChart chart={runGraphSource} /> : <EmptyState loading={loading} />}
        {selectedRun && (
          <RunDetails
            run={selectedRun}
            state={selectedRunState}
            stageStepIds={stageStepIds}
            onSelectStep={onSelectStep}
          />
        )}
      </div>
    </section>
  )
}
