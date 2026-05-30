import { ClipboardCheck, Play } from 'lucide-react'
import { inputPlaceholder } from '../lib/format'
import type { WorkflowSummary, WorkflowStep } from '../types/workflow'
import { RunStartConfirmCard } from './RunStartConfirmCard'

const friendlyInputLabels: Record<string, string> = {
  acceptance_criteria: '怎樣才算完成',
  'acceptance hint': '怎樣才算完成',
  acceptance_hint: '怎樣才算完成',
  base_ref: '從哪個版本開始比對',
  'feature keywords': '要找的關鍵字',
  feature_keywords: '要找的關鍵字',
  feature_request: '想請 AI 做什麼',
  search_terms: '要找的關鍵字',
}

const friendlyInputPlaceholders: Record<string, string> = {
  acceptance_criteria: '例：可以打開項目，按上一張/下一張看圖片',
  'acceptance hint': '例：可以打開項目，按上一張/下一張看圖片',
  acceptance_hint: '例：可以打開項目，按上一張/下一張看圖片',
  base_ref: '例：origin/main',
  'feature keywords': '例：漫畫、翻頁、閱讀器、圖片',
  feature_keywords: '例：漫畫、翻頁、閱讀器、圖片',
  feature_request: '例：新增漫畫翻頁閱讀模式',
  search_terms: '例：漫畫、翻頁、閱讀器、圖片',
}

function inputLabel(inputName: string): string {
  return friendlyInputLabels[inputName] ?? inputName.replaceAll('_', ' ')
}

function launchInputPlaceholder(inputName: string, required: boolean, summary: WorkflowSummary): string {
  return friendlyInputPlaceholders[inputName] ?? inputPlaceholder(inputName, required, summary)
}

export function TaskLaunchPanel({
  selectedWorkflow,
  selectedWorkflowSummary,
  hasRunInputExamples,
  runInputValues,
  runStartConfirm,
  steps,
  onCancelRunStartConfirm,
  onConfirmStartRun,
  onFillRunInputExamples,
  onOpenRunStartConfirm,
  onUpdateRunInput,
}: {
  selectedWorkflow: string
  selectedWorkflowSummary?: WorkflowSummary
  hasRunInputExamples: boolean
  runInputValues: Record<string, string>
  runStartConfirm: { missingInputs: string[]; outputs: string[]; stepCount: number } | null
  steps: WorkflowStep[]
  onCancelRunStartConfirm: () => void
  onConfirmStartRun: () => void
  onFillRunInputExamples: () => void
  onOpenRunStartConfirm: () => void
  onUpdateRunInput: (inputName: string, value: string) => void
}) {
  const missingInputs = selectedWorkflowSummary?.requiredInputs.filter(
    (inputName) => !runInputValues[inputName]?.trim(),
  ) ?? []
  const missingInputLabels = missingInputs.map(inputLabel)
  const outputNames = steps.map((step) => step.output?.trim()).filter(Boolean)
  const visibleOutputs = outputNames.slice(0, 4)
  const hiddenOutputCount = Math.max(outputNames.length - visibleOutputs.length, 0)
  const inputs = selectedWorkflowSummary
    ? [
      ...selectedWorkflowSummary.requiredInputs.map((name) => ({ name, required: true })),
      ...selectedWorkflowSummary.optionalInputs.map((name) => ({ name, required: false })),
    ]
    : []

  return (
    <section className="task-launch-panel" aria-label="任務啟動台">
      <div className="task-launch-header">
        <div>
          <span className="task-launch-kicker">任務啟動台</span>
          <h2>讓 AI 開始做事</h2>
          <p>填好資料後，AI 會照舞台上的積木一步一步做。</p>
        </div>
        <button
          className="task-launch-start"
          type="button"
          onClick={onOpenRunStartConfirm}
          disabled={!selectedWorkflowSummary}
        >
          <Play size={16} />
          {missingInputs.length > 0 ? '先補資料' : '開始前檢查'}
        </button>
      </div>

      <div className="task-launch-grid">
        <div className="task-launch-inputs">
          <div className="task-launch-section-title">
            <span>{selectedWorkflow || '尚未選流程'}</span>
            {hasRunInputExamples && (
              <button type="button" onClick={onFillRunInputExamples}>套用範例</button>
            )}
          </div>
          {inputs.length === 0 ? (
            <div className="mini-empty">這條流程沒有輸入欄位，可以直接開始前檢查。</div>
          ) : inputs.map((input) => (
            <label key={input.name}>
              <span>{inputLabel(input.name)}{input.required ? ' *' : ''}</span>
              <input
                aria-label={inputLabel(input.name)}
                value={runInputValues[input.name] ?? ''}
                onChange={(event) => onUpdateRunInput(input.name, event.target.value)}
                placeholder={selectedWorkflowSummary
                  ? launchInputPlaceholder(input.name, input.required, selectedWorkflowSummary)
                  : ''}
              />
            </label>
          ))}
        </div>

        <div className="task-launch-summary">
          <div className="task-launch-summary-title">
            <ClipboardCheck size={16} />
            開始前會檢查
          </div>
          <dl>
            <div>
              <dt>會跑幾塊積木</dt>
              <dd>{steps.length || selectedWorkflowSummary?.stepCount || 0} 塊</dd>
            </div>
            <div>
              <dt>還缺什麼</dt>
              <dd>{missingInputLabels.length > 0 ? missingInputLabels.join('、') : '需要的資料都填好了'}</dd>
            </div>
            <div>
              <dt>可能會做出</dt>
              <dd>
                {visibleOutputs.length > 0 ? (
                  <span className="task-launch-output-list">
                    {visibleOutputs.join('、')}
                    {hiddenOutputCount > 0 ? `，還有 ${hiddenOutputCount} 個` : ''}
                  </span>
                ) : '這條流程沒有寫明成果名稱'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {runStartConfirm && (
        <RunStartConfirmCard
          missingInputs={runStartConfirm.missingInputs.map(inputLabel)}
          outputs={runStartConfirm.outputs}
          stepCount={runStartConfirm.stepCount}
          onCancel={onCancelRunStartConfirm}
          onConfirm={onConfirmStartRun}
        />
      )}
    </section>
  )
}
