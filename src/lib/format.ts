import type { WorkflowSummary } from '../types/workflow'

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function friendlyErrorMessage(error: unknown): string {
  const message = errorMessage(error)
  if (message.includes('缺少必要輸入')) return `${message}。請把有 * 的格子填完再開始。`
  if (message.includes('workflow content is empty')) return 'workflow 內容是空的。請先放入流程內容再驗證或儲存。'
  if (message.includes('Unknown project')) return '找不到這個專案。請重新掃描後再試一次。'
  if (message.includes('timed out') || message.includes('timeout')) return '執行等太久了。請確認 ai-mc 指令沒有卡住，再重新試一次。'
  if (message.includes('ENOENT')) return '找不到需要的檔案或指令。請確認專案路徑和 ai-mc CLI 設定正確。'
  return message
}

export function formatDate(value: string): string {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function countLabel(count: number, unit: string): string {
  return `${count} ${unit}`
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: '已完成',
    blocked: '等待處理',
    running: '執行中',
    pending: '尚未開始',
    failed: '失敗',
    cancelled: '已取消',
  }
  return labels[status] ?? status
}

export function inputPlaceholder(inputName: string, required: boolean, summary: WorkflowSummary): string {
  const example = summary.inputExamples?.[inputName]
  if (example) return `例：${example}`
  return required ? '必填' : '選填'
}

export function readableValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(readableValue).join('、')
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${readableValue(item)}`)
      .join('、')
  }
  return String(value ?? '')
}

export function commandOptionLabel(name: string, value: unknown): string {
  if (typeof value === 'string' && value.trim()) return `${name} · ${value}`
  if (value && typeof value === 'object') {
    const command = 'command' in value ? readableValue((value as { command?: unknown }).command) : ''
    const description = 'description' in value ? readableValue((value as { description?: unknown }).description) : ''
    const detail = description || command
    if (detail) return `${name} · ${detail}`
  }
  return name
}
