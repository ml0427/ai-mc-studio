import type { BranchHandle, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from './types'

export const nodeTemplateMetadata: Array<{
  kind: WorkflowNodeKind
  title: string
  description: string
}> = [
  { kind: 'start', title: '起點', description: '流程從這裡開始。' },
  { kind: 'ai_task', title: 'AI 任務', description: '請 AI 做一件事，例如整理、判斷或產生內容。' },
  { kind: 'condition', title: '條件分支', description: '根據條件決定下一步要走哪條路。' },
  { kind: 'human_check', title: '人工確認', description: '暫停一下，讓人確認後再繼續。' },
  { kind: 'output', title: '輸出結果', description: '整理最後要留下或交付的內容。' },
]

export const nodeTypeLabels: Record<WorkflowNodeKind, string> = {
  start: '起點',
  ai_task: 'AI 任務',
  condition: '條件',
  human_check: '人工確認',
  output: '輸出',
  shell: 'Shell',
  tool: '工具',
  file: '檔案',
  code_edit: '改程式',
  terminal: '結束',
}

export const initialNodes: WorkflowNode[] = [
  {
    id: 'start-1',
    type: 'workflowNode',
    position: { x: 120, y: 120 },
    data: {
      kind: 'start',
      title: '起點',
      description: '流程從這裡開始。',
      purpose: '定義流程入口，讓後面的步驟有明確起點。',
      instructions: '',
      decisionRules: '',
      input: '',
      output: 'start',
    },
  },
]

export const initialEdges: WorkflowEdge[] = []

export const defaultConditionBranchHandles: BranchHandle[] = [
  { id: 'yes', label: '是' },
  { id: 'no', label: '否' },
]

export function nodeColor(kind: WorkflowNodeKind): string {
  if (kind === 'start') return '#89f7fe'
  if (kind === 'ai_task') return '#a78bfa'
  if (kind === 'condition') return '#fbbf24'
  if (kind === 'human_check') return '#34d399'
  if (kind === 'shell') return '#60a5fa'
  if (kind === 'tool') return '#2dd4bf'
  if (kind === 'file') return '#38bdf8'
  if (kind === 'code_edit') return '#fb7185'
  if (kind === 'terminal') return '#f97316'
  return '#38bdf8'
}
