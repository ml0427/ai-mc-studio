import { statusLabel } from '../lib/format'
import type { ProjectDetail, WizardRunSummary } from '../types/workflow'

export function StarterGuide({
  project,
  selectedWorkflow,
  selectedRun,
  requiredInputCount,
}: {
  project: ProjectDetail | null
  selectedWorkflow: string
  selectedRun?: WizardRunSummary
  requiredInputCount: number
}) {
  const items = [
    {
      title: '選一個專案',
      detail: project ? project.name : '先從左邊挑一個接入 workflow 的專案',
      done: Boolean(project),
    },
    {
      title: '挑一條流程',
      detail: selectedWorkflow || '像選 Scratch 作品一樣，先挑要跑的流程',
      done: Boolean(selectedWorkflow),
    },
    {
      title: '按開始執行',
      detail: selectedRun
        ? `${statusLabel(selectedRun.status)} · ${selectedRun.completedCount + selectedRun.skippedCount}/${selectedRun.totalSteps}`
        : requiredInputCount > 0
          ? `先填 ${requiredInputCount} 個必填欄位，再按上方的開始執行`
          : '可以直接按上方的開始執行',
      done: Boolean(selectedRun),
    },
  ]

  return (
    <section className="starter-guide" aria-label="快速開始">
      {items.map((item, index) => (
        <div className={`starter-step ${item.done ? 'done' : ''}`} key={item.title}>
          <span>{index + 1}</span>
          <div>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </div>
        </div>
      ))}
    </section>
  )
}
