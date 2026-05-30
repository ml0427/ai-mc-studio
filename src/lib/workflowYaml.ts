import YAML from 'yaml'
import { errorMessage } from './format'
import type { WorkflowDefinition, WorkflowSpec, WorkflowStep } from '../types/workflow'

export function parseWorkflowSpec(
  value: string,
  fallback?: WorkflowSpec | null,
): { spec: WorkflowSpec | null; error: string } {
  if (!value.trim()) return { spec: fallback ?? null, error: '' }
  try {
    return { spec: YAML.parse(value) as WorkflowSpec, error: '' }
  } catch (error) {
    return { spec: fallback ?? null, error: errorMessage(error) }
  }
}

export function buildClientMermaid(workflowName: string, workflow: WorkflowDefinition): string {
  const steps = workflow.steps ?? []
  const lines = [
    'flowchart TD',
    `  %% unsaved preview: ${workflowName}`,
  ]

  steps.forEach((step, index) => {
    const nodeId = mermaidNodeId(step, index)
    const label = [
      step.id,
      step.type,
      step.when ? `when: ${step.when}` : '',
    ].filter(Boolean).map(mermaidText).join('<br/>')
    lines.push(`  ${nodeId}["${label}"]`)
  })

  for (let index = 1; index < steps.length; index += 1) {
    const from = mermaidNodeId(steps[index - 1], index - 1)
    const to = mermaidNodeId(steps[index], index)
    const label = steps[index].when ? `|"${mermaidText(steps[index].when ?? '')}"|` : ''
    lines.push(`  ${from} -->${label} ${to}`)
  }

  lines.push(
    '  classDef ai fill:#eef2ff,stroke:#4f46e5,color:#111827;',
    '  classDef shell fill:#ecfdf5,stroke:#059669,color:#111827;',
    '  classDef edit fill:#fff7ed,stroke:#ea580c,color:#111827;',
    '  classDef tool fill:#f8fafc,stroke:#64748b,color:#111827;',
  )
  steps.forEach((step, index) => {
    lines.push(`  class ${mermaidNodeId(step, index)} ${mermaidTypeClass(step.type)};`)
  })

  return `${lines.join('\n')}\n`
}

export function wireMermaidStepClicks(
  element: HTMLDivElement,
  steps: WorkflowStep[],
  onSelectStep?: (stepId: string) => void,
) {
  if (!onSelectStep || steps.length === 0) return
  const nodes = [...element.querySelectorAll<SVGGElement>('g.node')]
  const longestFirst = [...steps].sort((left, right) => right.id.length - left.id.length)
  for (const node of nodes) {
    const text = node.textContent ?? ''
    const labelParts = [...node.querySelectorAll('tspan, span')]
      .map((item) => item.textContent?.trim() ?? '')
      .filter(Boolean)
    const step = longestFirst.find((item) => (
      labelParts.includes(item.id)
      || text.trim() === item.id
      || text.trim().startsWith(item.id)
    ))
    if (!step) continue
    node.dataset.stepId = step.id
    node.setAttribute('role', 'button')
    node.setAttribute('tabindex', '0')
    node.addEventListener('click', () => onSelectStep(step.id))
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSelectStep(step.id)
      }
    })
  }
}

export function highlightMermaidStep(element: HTMLDivElement, selectedStepId?: string) {
  const nodes = [...element.querySelectorAll<SVGGElement>('g.node')]
  for (const node of nodes) {
    node.classList.toggle('selected-mermaid-node', Boolean(selectedStepId && node.dataset.stepId === selectedStepId))
  }
}

function mermaidNodeId(step: WorkflowStep, index: number): string {
  const safe = String(step.id).replace(/[^A-Za-z0-9_]/g, '_')
  return `s${index}_${safe}`
}

function mermaidText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '<br/>')
}

function mermaidTypeClass(type: string): string {
  if (type === 'code-edit' || type === 'tool-or-code-edit') return 'edit'
  if (type === 'shell') return 'shell'
  if (type === 'ai') return 'ai'
  return 'tool'
}
