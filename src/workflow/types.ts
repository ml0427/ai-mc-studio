import type { Edge, Node } from '@xyflow/react'

export type WorkflowNodeKind =
  | 'start'
  | 'ai_task'
  | 'condition'
  | 'human_check'
  | 'output'
  | 'shell'
  | 'tool'
  | 'file'
  | 'code_edit'
  | 'terminal'

export type WorkflowNodeData = {
  kind: WorkflowNodeKind
  title: string
  description: string
  purpose: string
  instructions: string
  decisionRules: string
  input: string
  output: string
  branchHandles?: BranchHandle[]
}

export type BranchHandle = {
  id: string
  label: string
}

export type WorkflowNode = Node<WorkflowNodeData, 'workflowNode'>
export type WorkflowEdge = Edge
export type EditableField = keyof Pick<
  WorkflowNodeData,
  'title' | 'description' | 'purpose' | 'instructions' | 'decisionRules' | 'input' | 'output'
>
export type PreviewMode = 'aiMc' | 'graph' | 'canvas'
export type ThemeMode = 'dark' | 'light'

export type AiMcWorkflowStep = {
  id: string
  type: string
  label?: string
  title?: string
  description?: string
  purpose?: string
  instructions?: string | string[]
  decision_rules?: string | string[]
  when?: string
  input?: string | string[]
  output?: string
  blocks_downstream?: boolean
  command_ref?: string
  strategy?: unknown
  output_schema?: {
    required?: string[]
  }
}

export type AiMcGraphNode = {
  id: string
  kind?: string
  type?: string
  label?: string
  title?: string
  description?: string
  purpose?: string
  instructions?: string | string[]
  decision_rules?: string | string[]
  input?: string | string[]
  output?: string
  when?: string
  handles?: BranchHandle[]
}

export type AiMcGraphEdge = {
  from?: string
  source?: string
  to?: string
  target?: string
  branch?: string
  branch_label?: string
  label?: string
  handle?: string
  sourceHandle?: string
  targetHandle?: string
}

export type AiMcWorkflowSpec = {
  schema_version?: string
  name?: string
  description?: string
  workflows?: Record<string, {
    title?: string
    description?: string
    steps?: AiMcWorkflowStep[]
    graph?: {
      direction?: string
      nodes?: AiMcGraphNode[]
      edges?: AiMcGraphEdge[]
    }
  }>
}
