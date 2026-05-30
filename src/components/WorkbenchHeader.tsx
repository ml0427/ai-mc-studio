import { CheckCircle2, Play, Save, Undo2 } from 'lucide-react'
import { countLabel, statusLabel } from '../lib/format'
import type { ProjectDetail } from '../types/workflow'

export function WorkbenchHeader({
  project,
  selectedWorkflow,
  isDirty,
  canUndoEditor,
  onValidateProject,
  onStartRun,
  onUndoEditor,
  onSaveWorkflow,
}: {
  project: ProjectDetail | null
  selectedWorkflow: string
  isDirty: boolean
  canUndoEditor: boolean
  onValidateProject: () => void
  onStartRun: () => void
  onUndoEditor: () => void
  onSaveWorkflow: () => void
}) {
  return (
    <header className="workbench-header">
      <div>
        <p className="eyebrow">AI 司儀中控台</p>
        <h1>{project?.name ?? '選擇一個專案'}</h1>
        <div className="subtle-path">{project?.rootPath ?? '正在等待掃描結果'}</div>
        {project && (
          <div className="project-metrics">
            <span>{countLabel(project.workflowCount, '條流程')}</span>
            <span>{countLabel(project.stepCount, '個步驟')}</span>
            <span>{countLabel(project.runCount, '次執行')}</span>
            <span>{project.latestRun ? statusLabel(project.latestRun.status) : '尚未執行'}</span>
          </div>
        )}
      </div>
      <div className="header-actions">
        <button type="button" onClick={onValidateProject} disabled={!project}>
          <CheckCircle2 size={16} />
          {isDirty ? '驗證草稿' : '驗證'}
        </button>
        <button type="button" onClick={onStartRun} disabled={!project || !selectedWorkflow}>
          <Play size={16} />
          開始執行
        </button>
        <button type="button" onClick={onUndoEditor} disabled={!canUndoEditor}>
          <Undo2 size={16} />
          復原
        </button>
        <button type="button" className="primary" onClick={onSaveWorkflow} disabled={!project || !isDirty}>
          <Save size={16} />
          儲存流程{isDirty ? ' *' : ''}
        </button>
      </div>
    </header>
  )
}
