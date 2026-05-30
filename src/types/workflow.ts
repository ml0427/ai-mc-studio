export type WorkflowStep = {
  id: string
  type: string
  when?: string
  output?: string
  output_schema?: unknown
  command_ref?: string
  commands?: string[]
  delegate?: string
  task_class?: string
  blocks_downstream?: boolean
}

export type WorkflowDefinition = {
  description?: string
  steps?: WorkflowStep[]
  gates?: unknown
  evidence?: WorkflowEvidence
}

export type WorkflowEvidence = {
  commands?: Record<string, unknown>
}

export type WorkflowSpec = {
  schema_version?: string
  name?: string
  description?: string
  workflows?: Record<string, WorkflowDefinition>
}

export type WorkflowSummary = {
  name: string
  description: string
  stepCount: number
  requiredInputs: string[]
  optionalInputs: string[]
  inputExamples?: Record<string, string>
  gateCount: number
}

export type StepTemplate = {
  type: string
  label: string
  hint: string
  outputPrefix: string
}

export type ProjectSummary = {
  id: string
  name: string
  rootPath: string
  workflowPath: string
  workflowCount: number
  stepCount: number
  runCount: number
  latestRun?: WizardRunSummary
  workflows: WorkflowSummary[]
  scannedAt: string
}

export type ProjectDetail = ProjectSummary & {
  spec: WorkflowSpec
  rawYaml: string
  rawHash: string
}

export type ToastState = {
  tone: 'ok' | 'error' | 'info'
  message: string
}

export type ValidationResult = {
  tone: 'ok' | 'error'
  title: string
  output: string
}

export type WizardRunSummary = {
  runId: string
  workflow: string
  status: string
  currentStep: string | null
  completedCount: number
  skippedCount: number
  totalSteps: number
  updatedAt: string
  statePath: string
}

export type WizardRunState = {
  run_id?: string
  workflow?: string
  status?: string
  current_step?: string | null
  completed_steps?: unknown[]
  skipped_steps?: unknown[]
  steps?: unknown[]
  created_at?: string
  updated_at?: string
  inputs?: Record<string, unknown>
}
