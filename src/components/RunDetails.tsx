import { useState } from 'react'
import { Box, CheckCircle2, Clipboard, HelpCircle } from 'lucide-react'
import { formatDate, readableValue, statusLabel } from '../lib/format'
import {
  buildStepResults,
  resultDisplayTitle,
  resultSentence,
  resultStatusLabel,
  runStepId,
  stepTypeHint,
  stepTypeLabel,
  type ResultStep,
} from '../lib/runResults'
import type { WizardRunState, WizardRunSummary } from '../types/workflow'

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
                  <strong>{resultDisplayTitle(step)}</strong>
                  <small>步驟：{step.id} · {stepTypeLabel(step.type)} · {resultStatusLabel(step.status)}</small>
                </span>
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
