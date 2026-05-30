import { useState } from 'react'
import { Box, CheckCircle2, Clipboard, HelpCircle } from 'lucide-react'
import { formatDate, readableValue, statusLabel } from '../lib/format'
import type { WizardRunState, WizardRunSummary } from '../types/workflow'

type RunStepInfo = {
  id: string
  type: string
  output: string
  when: string
  commandRef: string
  delegate: string
  taskClass: string
}

type ResultStep = RunStepInfo & {
  status: 'completed' | 'skipped' | 'pending'
  artifactPath: string
  detailValue: string
}

export function RunDetails({
  run,
  state,
  onSelectStep,
}: {
  run: WizardRunSummary
  state: WizardRunState | null
  onSelectStep: (stepId: string) => void
}) {
  const inputs = state?.inputs ?? {}
  const completedSteps = (state?.completed_steps ?? []).map(runStepId)
  const skippedSteps = (state?.skipped_steps ?? []).map(runStepId)
  const stepResults = buildStepResults(
    state?.steps ?? [],
    completedSteps,
    skippedSteps,
    state?.context ?? {},
    state?.required_artifacts ?? {},
  )
  const doneCount = run.completedCount + run.skippedCount
  const percent = run.totalSteps > 0 ? Math.round((doneCount / run.totalSteps) * 100) : 0
  const progressTitle = run.currentStep
    ? `正在第 ${Math.min(doneCount + 1, run.totalSteps)}/${run.totalSteps} 步`
    : run.status === 'completed'
      ? '流程已跑完'
      : statusLabel(run.status)
  const pendingSteps = (state?.steps ?? []).map(runStepId).filter(
    (step) => !completedSteps.includes(step) && !skippedSteps.includes(step),
  )

  return (
    <div className="run-details">
      <RunHintCard run={run} stateReady={Boolean(state)} onSelectStep={onSelectStep} />
      <div className="run-progress">
        <div>
          <strong>{progressTitle}</strong>
          <span>{run.currentStep ?? statusLabel(run.status)}</span>
        </div>
        <div className="progress-track" aria-label={`執行進度 ${percent}%`}>
          <div style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="run-detail-grid">
        <span>狀態</span>
        <strong>{statusLabel(run.status)}</strong>
        <span>目前步驟</span>
        <strong>{run.currentStep ?? '已完成'}</strong>
        <span>進度</span>
        <strong>{run.completedCount + run.skippedCount}/{run.totalSteps}</strong>
        <span>更新時間</span>
        <strong>{formatDate(run.updatedAt)}</strong>
      </div>

      <ResultCollection
        stateReady={Boolean(state)}
        inputs={inputs}
        completedSteps={completedSteps}
        skippedSteps={skippedSteps}
        pendingSteps={pendingSteps}
        stepResults={stepResults}
        statePath={run.statePath}
      />
    </div>
  )
}

function RunHintCard({
  run,
  stateReady,
  onSelectStep,
}: {
  run: WizardRunSummary
  stateReady: boolean
  onSelectStep: (stepId: string) => void
}) {
  const nextAction = run.status === 'failed'
    ? '先看錯誤訊息，修好後再重新開始。'
    : run.status === 'blocked'
      ? '這裡需要你處理或補資料，處理完再繼續。'
      : run.currentStep
        ? '正在跑這塊積木，等它完成後看成果收集箱。'
        : run.status === 'completed'
          ? '流程跑完了，可以查看成果收集箱。'
          : stateReady
            ? '等待下一次狀態更新。'
            : '正在讀取執行紀錄。'

  return (
    <button
      className={`run-hint-card ${run.status}`}
      type="button"
      onClick={() => run.currentStep && onSelectStep(run.currentStep)}
      disabled={!run.currentStep}
    >
      <HelpCircle size={18} />
      <span>
        <strong>{run.currentStep ? `現在跑到：${run.currentStep}` : statusLabel(run.status)}</strong>
        <small>{nextAction}</small>
      </span>
    </button>
  )
}

function ResultCollection({
  stateReady,
  inputs,
  completedSteps,
  skippedSteps,
  pendingSteps,
  stepResults,
  statePath,
}: {
  stateReady: boolean
  inputs: Record<string, unknown>
  completedSteps: string[]
  skippedSteps: string[]
  pendingSteps: string[]
  stepResults: ResultStep[]
  statePath: string
}) {
  const [copyFeedback, setCopyFeedback] = useState<{ key: string; status: 'copied' | 'failed' } | null>(null)
  const inputPairs = Object.entries(inputs)

  async function copyResult(text: string, key: string) {
    const copied = await copyText(text)
    setCopyFeedback({ key, status: copied ? 'copied' : 'failed' })
    window.setTimeout(() => setCopyFeedback(null), 1600)
  }

  return (
    <div className="result-collection">
      <div className="panel-title">
        <Box size={16} />
        成果收集箱
      </div>
      {!stateReady && (
        <div className="mini-empty">正在讀取這次執行的詳細紀錄，稍等一下就會放進收集箱。</div>
      )}
      <div className="result-grid">
        <ResultCard title="已完成" value={`${completedSteps.length} 塊`} items={completedSteps} />
        <ResultCard title="跳過" value={`${skippedSteps.length} 塊`} items={skippedSteps} />
        <ResultCard title="還沒跑" value={`${pendingSteps.length} 塊`} items={pendingSteps} />
      </div>
      <div className="result-step-list">
        <span>每塊積木做出的成果</span>
        {stepResults.length === 0 ? (
          <div className="mini-empty">這次執行還沒有積木明細，成果內容暫時讀不到。</div>
        ) : stepResults.map((step, index) => {
          const copyText = step.artifactPath || step.detailValue || step.output || step.id
          const canCopy = Boolean(copyText)
          const feedback = copyFeedback?.key === step.id ? copyFeedback.status : ''

          return (
            <details className={`result-step-card ${step.status}`} key={`${step.id}-${index}`}>
              <summary>
                <span className="result-step-index">第 {index + 1} 塊</span>
                <span className="result-step-main">
                  <strong>{step.id}</strong>
                  <small>{stepTypeLabel(step.type)} · {resultStatusLabel(step.status)}</small>
                </span>
                {step.output && <span className="result-step-output">產物：{step.output}</span>}
              </summary>
              <div className="result-step-body">
                <p>{resultSentence(step)}</p>
                <dl>
                  <div>
                    <dt>這塊做什麼</dt>
                    <dd>{step.when || stepTypeHint(step.type)}</dd>
                  </div>
                  {step.artifactPath && (
                    <div>
                      <dt>結果位置</dt>
                      <dd>{step.artifactPath}</dd>
                    </div>
                  )}
                  {step.detailValue && !step.artifactPath && (
                    <div>
                      <dt>結果摘要</dt>
                      <dd>{step.detailValue}</dd>
                    </div>
                  )}
                  {step.commandRef && (
                    <div>
                      <dt>指令名稱</dt>
                      <dd>{step.commandRef}</dd>
                    </div>
                  )}
                  {step.delegate && (
                    <div>
                      <dt>小幫手</dt>
                      <dd>{step.delegate}</dd>
                    </div>
                  )}
                  {step.taskClass && (
                    <div>
                      <dt>任務類型</dt>
                      <dd>{step.taskClass}</dd>
                    </div>
                  )}
                </dl>
                {canCopy && (
                  <button
                    className="copy-result-button"
                    type="button"
                    onClick={() => void copyResult(copyText, step.id)}
                  >
                    {feedback === 'copied' ? <CheckCircle2 size={14} /> : <Clipboard size={14} />}
                    {feedback === 'copied' ? '已複製' : feedback === 'failed' ? '複製失敗' : '複製'}
                  </button>
                )}
              </div>
            </details>
          )
        })}
      </div>
      <div className="result-inputs">
        <span>這次帶進流程的內容</span>
        {inputPairs.length === 0 ? (
          <small>無</small>
        ) : inputPairs.map(([key, value]) => (
          <small key={key}>{key}: {readableValue(value)}</small>
        ))}
      </div>
      <div className="run-state-path" title={statePath}>進階紀錄位置：{statePath}</div>
    </div>
  )
}

function ResultCard({ title, value, items }: { title: string; value: string; items: string[] }) {
  return (
    <div className="result-card">
      <span>{title}</span>
      <strong>{value}</strong>
      {items.length > 0 && (
        <div className="run-step-pills">
          {items.slice(0, 6).map((item) => <small key={item}>{item}</small>)}
          {items.length > 6 && <small>還有 {items.length - 6} 塊</small>}
        </div>
      )}
    </div>
  )
}

function runStepId(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id?: unknown }).id ?? '')
  }
  return String(value ?? '')
}

function runStepInfo(value: unknown): RunStepInfo {
  if (typeof value === 'string') {
    return {
      id: value,
      type: '',
      output: '',
      when: '',
      commandRef: '',
      delegate: '',
      taskClass: '',
    }
  }

  if (!value || typeof value !== 'object') return runStepInfo(String(value ?? ''))
  const step = value as Record<string, unknown>
  return {
    id: String(step.id ?? ''),
    type: String(step.type ?? ''),
    output: String(step.output ?? ''),
    when: String(step.when ?? ''),
    commandRef: String(step.command_ref ?? ''),
    delegate: String(step.delegate ?? ''),
    taskClass: String(step.task_class ?? ''),
  }
}

function buildStepResults(
  steps: unknown[],
  completedSteps: string[],
  skippedSteps: string[],
  context: Record<string, unknown>,
  requiredArtifacts: Record<string, unknown>,
): ResultStep[] {
  const completed = new Set(completedSteps)
  const skipped = new Set(skippedSteps)
  const stepInfos = steps.map(runStepInfo).filter((step) => step.id)
  const knownIds = new Set(stepInfos.map((step) => step.id))

  for (const stepId of [...completedSteps, ...skippedSteps]) {
    if (!knownIds.has(stepId)) stepInfos.push(runStepInfo(stepId))
  }

  return stepInfos.map((step) => {
    const artifactPath = findArtifactPath(step, context, requiredArtifacts)
    const detailValue = findDetailValue(step, context, artifactPath)
    return {
      ...step,
      status: skipped.has(step.id) ? 'skipped' : completed.has(step.id) ? 'completed' : 'pending',
      artifactPath,
      detailValue,
    }
  })
}

function findArtifactPath(
  step: RunStepInfo,
  context: Record<string, unknown>,
  requiredArtifacts: Record<string, unknown>,
): string {
  const keys = [
    step.output,
    `${step.output}_artifact_path`,
    step.id,
    `${step.id}_artifact_path`,
  ].filter(Boolean)

  for (const key of keys) {
    const value = requiredArtifacts[key] ?? context[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  return ''
}

function findDetailValue(step: RunStepInfo, context: Record<string, unknown>, artifactPath: string): string {
  if (!step.output) return ''
  const value = context[step.output]
  if (!value || value === artifactPath) return ''
  return readableValue(value)
}

function resultSentence(step: ResultStep): string {
  if (step.status === 'skipped') return '這塊這次沒有執行，所以沒有新的成果。'
  if (step.status === 'pending') return '這塊還沒跑，完成後成果會放到這裡。'
  if (step.artifactPath) return '這塊積木做完了，並留下可以查看的結果位置。'
  if (step.detailValue) return '這塊積木做完了，下面是它留下的結果摘要。'
  return '這塊積木做完了，但目前沒有留下可預覽的成果。'
}

function resultStatusLabel(status: ResultStep['status']): string {
  if (status === 'completed') return '完成'
  if (status === 'skipped') return '略過'
  return '還沒跑'
}

function stepTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ai: '請 AI 幫忙',
    shell: '執行指令',
    'tool-or-shell': '用工具或指令',
    'tool-or-code-edit': '用工具或改程式',
    file: '整理檔案',
    'code-edit': '修改程式',
  }
  return labels[type] ?? (type || '積木')
}

function stepTypeHint(type: string): string {
  const hints: Record<string, string> = {
    ai: '請 AI 判斷、整理或產生內容。',
    shell: '在專案裡執行一段指令。',
    'tool-or-shell': '用工具或指令取得需要的資料。',
    'tool-or-code-edit': '用工具檢查，也可能改動程式。',
    file: '讀取、整理或產生檔案。',
    'code-edit': '修改專案程式碼。',
  }
  return hints[type] ?? '照這塊積木的設定執行。'
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall back to a temporary textarea for browsers that block clipboard.writeText.
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}
