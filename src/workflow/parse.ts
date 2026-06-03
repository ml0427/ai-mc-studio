import YAML from 'yaml'

import { branchLabelForHandle, canonicalConditionHandleId, localizedBranchLabel, makeWorkflowEdge } from './edges'
import { layoutGraph } from './layout'
import { formatCompactValue, localizeWorkflowTerm, localizeWorkflowText } from './localization'
import { initialNodes, nodeTemplateMetadata } from './templates'
import type { AiMcGraphEdge, AiMcGraphNode, AiMcWorkflowSpec, AiMcWorkflowStep, BranchHandle, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from './types'
import { normalizeInput, normalizeTextBlock, sanitizeStepId } from './utils'

export function parseAiMcWorkflow(value: string, requestedWorkflowName = ''): {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  stepCount: number
  workflowName: string
} {
  const parsed = parseWorkflowText(value)
  const workflows = parsed.workflows ?? {}
  const workflowNames = Object.keys(workflows)
  const workflowName = requestedWorkflowName && workflows[requestedWorkflowName]
    ? requestedWorkflowName
    : workflows.main ? 'main' : workflowNames[0]
  const workflow = workflowName ? workflows[workflowName] : null
  const steps = workflow?.steps ?? []

  if (!workflow || !Array.isArray(steps)) {
    throw new Error('找不到 workflows 裡面的 steps，請貼上 ai-mc workflow.yaml 或 JSON。')
  }

  if (hasGraph(workflow)) {
    return parseGraphWorkflow(workflowName, workflow, steps)
  }

  const importedNodes = [
    initialNodes[0],
    ...steps.map((step, index) => aiMcStepToNode(step, index)),
  ]
  const importedEdges = steps.map((step, index) => {
    const source = index === 0 ? 'start-1' : sanitizeStepId(steps[index - 1].id)
    const target = sanitizeStepId(step.id)
    const sourceNode = importedNodes.find((node) => node.id === source)
    return makeWorkflowEdge(source, target, sourceNode?.data.kind)
  })

  return {
    nodes: importedNodes,
    edges: importedEdges,
    stepCount: steps.length,
    workflowName,
  }
}

export function workflowNamesFromText(value: string): string[] {
  if (!value.trim()) return []
  try {
    const parsed = parseWorkflowText(value)
    return Object.keys(parsed.workflows ?? {})
  } catch {
    return []
  }
}

function hasGraph(workflow: NonNullable<AiMcWorkflowSpec['workflows']>[string]) {
  return Array.isArray(workflow.graph?.nodes) && Array.isArray(workflow.graph?.edges)
}

function parseGraphWorkflow(
  workflowName: string,
  workflow: NonNullable<AiMcWorkflowSpec['workflows']>[string],
  steps: AiMcWorkflowStep[],
): {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  stepCount: number
  workflowName: string
} {
  const graphNodes = workflow.graph?.nodes ?? []
  const graphEdges = workflow.graph?.edges ?? []

  if (graphNodes.length === 0) {
    throw new Error('這份 graph workflow 沒有 graph.nodes，畫布不知道要畫哪些節點。')
  }

  const stepById = new Map(steps.map((step) => [step.id, step]))
  const idByOriginal = makeGraphIdMap(graphNodes)
  const branchHandlesByNode = makeBranchHandlesByNode(graphNodes, graphEdges)
  const positions = layoutGraph(graphNodes, graphEdges)
  const importedNodes = graphNodes.map((graphNode) => graphNodeToWorkflowNode(
    graphNode,
    stepById.get(graphNode.id),
    idByOriginal,
    positions,
    branchHandlesByNode,
  ))
  const kindById = new Map(importedNodes.map((node) => [node.id, node.data.kind]))
  const importedEdges = graphEdges
    .map((graphEdge, index) => graphEdgeToWorkflowEdge(graphEdge, index, idByOriginal, kindById, branchHandlesByNode))
    .filter((edge): edge is WorkflowEdge => Boolean(edge))

  return {
    nodes: importedNodes,
    edges: importedEdges,
    stepCount: importedNodes.length,
    workflowName,
  }
}

function makeGraphIdMap(graphNodes: AiMcGraphNode[]) {
  const usedIds = new Set<string>()
  return new Map(graphNodes.map((node) => {
    const baseId = sanitizeStepId(node.id)
    let safeId = baseId
    let count = 2
    while (usedIds.has(safeId)) {
      safeId = `${baseId}-${count}`
      count += 1
    }
    usedIds.add(safeId)
    return [node.id, safeId]
  }))
}

function graphNodeToWorkflowNode(
  graphNode: AiMcGraphNode,
  step: AiMcWorkflowStep | undefined,
  idByOriginal: Map<string, string>,
  positions: Map<string, { x: number; y: number }>,
  branchHandlesByNode: Map<string, BranchHandle[]>,
): WorkflowNode {
  const id = idByOriginal.get(graphNode.id) ?? sanitizeStepId(graphNode.id)
  const kind = graphKindFromType(graphNode.kind ?? graphNode.type ?? step?.type)
  const rawTitle = graphNode.label || graphNode.title || step?.label || step?.title || graphNode.id
  const title = localizeWorkflowText(rawTitle)
  const description = cleanGraphDescription(graphNode.description)
    || step?.description
    || step?.when
    || graphNode.when
    || readableStepDescription(step)
    || graphNode.type
    || step?.type
    || ''

  return {
    id,
    type: 'workflowNode',
    position: positions.get(graphNode.id) ?? { x: 160, y: 120 },
    data: {
      kind,
      title,
      description,
      purpose: normalizeTextBlock(graphNode.purpose ?? step?.purpose),
      instructions: normalizeTextBlock(graphNode.instructions ?? step?.instructions),
      decisionRules: normalizeTextBlock(graphNode.decision_rules ?? step?.decision_rules),
      input: normalizeInput(graphNode.input ?? step?.input),
      output: graphNode.output || step?.output || graphNode.id,
      branchHandles: branchHandlesByNode.get(graphNode.id),
    },
  }
}

function cleanGraphDescription(value: string | undefined) {
  if (!value || value.includes('[object Object]')) return ''
  if (/^AI\s*\?\?$/.test(value.trim())) return ''
  return localizeWorkflowText(value)
}

function readableStepDescription(step: AiMcWorkflowStep | undefined) {
  if (!step) return ''
  if (step.output_schema?.required?.length) {
    return `輸出：${step.output_schema.required.map(localizeWorkflowTerm).join('、')}`
  }
  const parts = [
    step.command_ref ? `指令：${localizeWorkflowTerm(step.command_ref)}` : '',
    step.strategy ? `策略：${formatCompactValue(step.strategy)}` : '',
    step.output ? `輸出：${localizeWorkflowTerm(step.output)}` : '',
  ].filter(Boolean)
  const summary = parts.join('；')
  if (summary) return summary
  if (step.type === 'ai') return 'AI 任務'
  return ''
}

function makeBranchHandlesByNode(graphNodes: AiMcGraphNode[], graphEdges: AiMcGraphEdge[]) {
  const handlesByNode = new Map<string, BranchHandle[]>()
  const conditionIds = new Set(
    graphNodes
      .filter((node) => graphKindFromType(node.kind ?? node.type) === 'condition')
      .map((node) => node.id),
  )

  for (const node of graphNodes) {
    if (node.handles?.length) {
      handlesByNode.set(node.id, dedupeBranchHandles(node.handles.map((handle) => ({
        id: canonicalConditionHandleId(handle.id),
        label: localizeWorkflowText(handle.label || handle.id),
      }))))
    }
  }

  for (const edge of graphEdges) {
    const source = edge.from ?? edge.source
    if (!source || !conditionIds.has(source)) continue
    const current = handlesByNode.get(source) ?? []
    const handle = branchHandleFromEdge(edge)
    if (!current.some((item) => item.id === handle.id)) {
      handlesByNode.set(source, [...current, handle])
    }
  }

  return handlesByNode
}

function branchHandleFromEdge(edge: AiMcGraphEdge): BranchHandle {
  const rawId = edge.sourceHandle ?? edge.handle ?? edge.branch ?? edge.branch_label ?? edge.label ?? 'branch'
  const id = canonicalConditionHandleId(rawId)
  const label = edge.branch_label || edge.label || localizedBranchLabel(edge.branch) || branchLabelForHandle(id) || rawId
  return {
    id,
    label: localizeWorkflowText(label),
  }
}

function dedupeBranchHandles(handles: BranchHandle[]) {
  const used = new Set<string>()
  return handles.filter((handle) => {
    if (used.has(handle.id)) return false
    used.add(handle.id)
    return true
  })
}

function graphEdgeToWorkflowEdge(
  graphEdge: AiMcGraphEdge,
  index: number,
  idByOriginal: Map<string, string>,
  kindById: Map<string, WorkflowNodeKind>,
  branchHandlesByNode: Map<string, BranchHandle[]>,
): WorkflowEdge | null {
  const originalSource = graphEdge.from ?? graphEdge.source
  const originalTarget = graphEdge.to ?? graphEdge.target
  if (!originalSource || !originalTarget) return null

  const source = idByOriginal.get(originalSource)
  const target = idByOriginal.get(originalTarget)
  if (!source || !target) return null

  const sourceKind = kindById.get(source)
  const sourceBranchHandles = branchHandlesByNode.get(originalSource) ?? []
  const sourceHandle = sourceHandleForGraphEdge(graphEdge, sourceKind)
  const label = graphEdge.branch_label || graphEdge.label || localizedBranchLabel(graphEdge.branch)

  return makeWorkflowEdge(source, target, sourceKind, {
    id: `graph-${index}-${source}:${sourceHandle}->${target}:top`,
    sourceHandle,
    label: label ? localizeWorkflowText(label) : undefined,
    sourceBranchHandles,
    targetHandle: graphEdge.targetHandle ?? 'top',
  })
}

function sourceHandleForGraphEdge(
  edge: AiMcGraphEdge,
  sourceKind?: WorkflowNodeKind,
) {
  if (sourceKind !== 'condition') return 'bottom'
  const explicitHandle = edge.sourceHandle ?? edge.handle
  if (explicitHandle) return canonicalConditionHandleId(explicitHandle)
  const handle = branchHandleFromEdge(edge)
  return handle.id
}

function parseWorkflowText(value: string): AiMcWorkflowSpec {
  try {
    return JSON.parse(value) as AiMcWorkflowSpec
  } catch {
    try {
      return YAML.parse(value) as AiMcWorkflowSpec
    } catch {
      throw new Error('讀不懂這段內容：請貼上合法的 YAML 或 JSON。')
    }
  }
}

function aiMcStepToNode(step: AiMcWorkflowStep, index: number): WorkflowNode {
  const kind = aiMcKindFromStep(step)
  const template = nodeTemplateMetadata.find((item) => item.kind === kind) ?? nodeTemplateMetadata[1]
  return {
    id: sanitizeStepId(step.id),
    type: 'workflowNode',
    position: {
      x: 420 + (index % 2) * 280,
      y: 120 + index * 150,
    },
    data: {
      kind,
      title: localizeWorkflowText(step.label || step.title || template.title),
      description: step.description || step.when || template.description,
      purpose: normalizeTextBlock(step.purpose),
      instructions: normalizeTextBlock(step.instructions),
      decisionRules: normalizeTextBlock(step.decision_rules),
      input: normalizeInput(step.input),
      output: step.output || step.id,
    },
  }
}

function aiMcKindFromStep(step: AiMcWorkflowStep): WorkflowNodeKind {
  if (step.blocks_downstream) return 'human_check'
  if (step.type === 'shell') return 'shell'
  if (step.type === 'tool-or-shell') return 'tool'
  if (step.type === 'tool-or-code-edit') return 'code_edit'
  if (step.type === 'code-edit') return 'code_edit'
  if (step.type === 'file') return 'file'
  if (step.when) return 'condition'
  return 'ai_task'
}

export function graphKindFromType(type: string | undefined): WorkflowNodeKind {
  if (type === 'condition') return 'condition'
  if (type === 'terminal') return 'terminal'
  if (type === 'shell') return 'shell'
  if (type === 'file') return 'file'
  if (type === 'tool-or-shell') return 'tool'
  if (type === 'tool-or-code-edit') return 'code_edit'
  if (type === 'code-edit') return 'code_edit'
  if (type === 'human_check') return 'human_check'
  if (type === 'output') return 'output'
  if (type === 'start') return 'start'
  return 'ai_task'
}
