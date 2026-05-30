import { readableValue } from './format'

export type RunStepInfo = {
  id: string
  type: string
  output: string
  when: string
  commandRef: string
  delegate: string
  taskClass: string
}

export type ResultStep = RunStepInfo & {
  status: 'completed' | 'skipped' | 'pending'
  artifactPath: string
  detailValue: string
}

export function runStepId(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id?: unknown }).id ?? '')
  }
  return String(value ?? '')
}

export function runStepInfo(value: unknown): RunStepInfo {
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

export function buildStepResults(
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

export function findArtifactPath(
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

export function findDetailValue(
  step: RunStepInfo,
  context: Record<string, unknown>,
  artifactPath: string,
): string {
  if (!step.output) return ''
  const value = context[step.output]
  if (!value || value === artifactPath) return ''
  return readableValue(value)
}

export function resultDisplayTitle(step: ResultStep): string {
  const output = step.output.trim()
  const when = step.when.trim()
  const id = step.id.trim()

  if (output) return `產物：${shortenResultTitle(output)}`
  if (when) return shortenResultTitle(when)
  if (step.type) return stepTypeLabel(step.type)
  return id ? `步驟：${shortenResultTitle(id)}` : '積木成果'
}

export function shortenResultTitle(text: string, maxLength = 32): string {
  const value = text.trim()
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

export function resultSentence(step: ResultStep): string {
  if (step.status === 'skipped') return '這塊這次沒有執行，所以沒有新的成果。'
  if (step.status === 'pending') return '這塊還沒跑，完成後成果會放到這裡。'
  if (step.artifactPath) return '這塊積木做完了，並留下可以查看的結果位置。'
  if (step.detailValue) return '這塊積木做完了，下面是它留下的結果摘要。'
  return '這塊積木做完了，但目前沒有留下可預覽的成果。'
}

export function resultStatusLabel(status: ResultStep['status']): string {
  if (status === 'completed') return '完成'
  if (status === 'skipped') return '略過'
  return '還沒跑'
}

export function stepTypeLabel(type: string): string {
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

export function stepTypeHint(type: string): string {
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
