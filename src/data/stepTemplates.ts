import type { StepTemplate, WorkflowStep } from '../types/workflow'

export const STEP_TEMPLATES: StepTemplate[] = [
  {
    type: 'ai',
    label: '請 AI 想一想',
    hint: '整理想法、做判斷、寫說明',
    outputPrefix: 'ai_step',
  },
  {
    type: 'shell',
    label: '請電腦執行指令',
    hint: '跑測試、建置、查狀態',
    outputPrefix: 'run_command',
  },
  {
    type: 'tool-or-shell',
    label: '用工具或指令',
    hint: '先試工具，不行再跑指令',
    outputPrefix: 'tool_step',
  },
  {
    type: 'tool-or-code-edit',
    label: '用工具或改檔案',
    hint: '讓 AI 做一段清楚改動',
    outputPrefix: 'edit_with_tool',
  },
  {
    type: 'code-edit',
    label: '修改程式',
    hint: '真的動到程式碼',
    outputPrefix: 'code_change',
  },
  {
    type: 'file',
    label: '讀寫檔案',
    hint: '產生或檢查檔案',
    outputPrefix: 'file_step',
  },
]

export function stepTypeMeta(type: string): { label: string; hint: string; className: string } {
  const map: Record<string, { label: string; hint: string; className: string }> = {
    ai: {
      label: '請 AI 想一想',
      hint: '適合整理、判斷、寫說明',
      className: 'type-ai',
    },
    shell: {
      label: '請電腦執行指令',
      hint: '適合跑測試、建置、查狀態',
      className: 'type-shell',
    },
    'tool-or-shell': {
      label: '用工具或指令',
      hint: '可以交給工具，也可以跑命令',
      className: 'type-tool',
    },
    'tool-or-code-edit': {
      label: '用工具或改檔案',
      hint: '適合讓 AI 實作一小段改動',
      className: 'type-edit',
    },
    file: {
      label: '讀寫檔案',
      hint: '適合產生或檢查檔案',
      className: 'type-file',
    },
    'code-edit': {
      label: '修改程式',
      hint: '適合真的改程式碼',
      className: 'type-edit',
    },
  }
  return map[type] ?? {
    label: type,
    hint: '自訂步驟類型',
    className: 'type-tool',
  }
}

export function uniqueStepId(steps: WorkflowStep[], prefix: string): string {
  const used = new Set(steps.map((step) => step.id))
  let index = steps.length + 1
  let candidate = `${prefix}_${index}`
  while (used.has(candidate)) {
    index += 1
    candidate = `${prefix}_${index}`
  }
  return candidate
}
