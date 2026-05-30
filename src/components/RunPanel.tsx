import { History, RefreshCw, Workflow } from 'lucide-react'
import { formatDate, statusLabel } from '../lib/format'
import type { ProjectDetail, WizardRunState, WizardRunSummary } from '../types/workflow'
import { EmptyState } from './EmptyState'
import { MermaidChart } from './MermaidChart'
import { RunDetails } from './RunDetails'
import { StepLegend } from './StepSummary'

export function RunPanel({
  project,
  runs,
  selectedRunId,
  selectedRun,
  selectedRunState,
  runGraphSource,
  stageStepIds,
  loading,
  onRefreshRuns,
  onSelectRun,
  onSelectStep,
}: {
  project: ProjectDetail | null
  runs: WizardRunSummary[]
  selectedRunId: string
  selectedRun?: WizardRunSummary
  selectedRunState: WizardRunState | null
  runGraphSource: string
  stageStepIds: string[]
  loading: boolean
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
