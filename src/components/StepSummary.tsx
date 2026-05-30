import { stepTypeMeta } from '../data/stepTemplates'
import type { WorkflowStep } from '../types/workflow'

export function SelectedStepSummary({ step, error }: { step?: WorkflowStep; error: string }) {
  if (error) return <pre className="yaml-view error-text">{error}</pre>
  if (!step) return <div className="mini-empty">尚未選擇步驟</div>

  const facts = [
    ['積木名稱', step.id],
    ['做的事情', stepTypeMeta(step.type).label],
    ['什麼時候做', step.when || '接到上一塊就做'],
    ['完成後名字', step.output || '尚未命名'],
    ['會不會卡住後面', step.blocks_downstream ? '會，需要先處理' : '不會'],
  ]

  return (
    <div className="step-summary">
      {facts.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}

export function StepLegend({ compact = false }: { compact?: boolean }) {
  const items = compact
    ? ['ai', 'shell', 'code-edit', 'file']
    : ['ai', 'shell', 'tool-or-shell', 'tool-or-code-edit', 'code-edit', 'file']
  return (
    <div className={`step-legend ${compact ? 'compact' : ''}`}>
      {items.map((type) => {
        const meta = stepTypeMeta(type)
        return (
          <span className={meta.className} key={type}>
            <i />
            {meta.label}
          </span>
        )
      })}
    </div>
  )
}
