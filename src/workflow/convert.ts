import type { AiMcWorkflowSpec, AiMcWorkflowStep, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from './types'
import { edgeLabel } from './edges'
import { parseInputList, parseLines, sanitizeStepId } from './utils'

export function toAiMcWorkflowSpec(nodes: WorkflowNode[], edges: WorkflowEdge[]): AiMcWorkflowSpec {
  const orderedNodes = orderWorkflowNodes(nodes, edges)
  return {
    schema_version: '1',
    name: 'ai-flow-mvp',
    description: '從拖拉式流程圖產生的 ai-mc workflow 草稿。',
    workflows: {
      main: {
        description: '主要流程',
        steps: orderedNodes
          .filter((node) => node.data.kind !== 'start')
          .map((node) => toAiMcStep(node)),
      },
    },
  }
}

export function toAiMcStep(node: WorkflowNode): AiMcWorkflowStep {
  const step: AiMcWorkflowStep = {
    id: sanitizeStepId(node.id),
    type: aiMcStepType(node.data.kind),
  }
  if (node.data.description.trim()) {
    step.description = node.data.description.trim()
  }
  if (node.data.purpose.trim()) {
    step.purpose = node.data.purpose.trim()
  }
  const instructions = parseLines(node.data.instructions)
  if (instructions.length) {
    step.instructions = instructions
  }
  const decisionRules = parseLines(node.data.decisionRules)
  if (decisionRules.length) {
    step.decision_rules = decisionRules
  }
  if (node.data.kind === 'condition' && node.data.description.trim()) {
    step.when = node.data.description.trim()
  }
  if (node.data.input.trim()) {
    step.input = parseInputList(node.data.input)
  }
  if (node.data.output.trim()) {
    step.output = sanitizeStepId(node.data.output)
  }
  if (node.data.kind === 'human_check') {
    step.blocks_downstream = true
  }
  return step
}

export function toGraphWorkflowSpec(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const orderedNodes = orderWorkflowNodes(nodes, edges)
  return {
    schema_version: '0.2-graph',
    name: 'ai-flow-graph',
    language: 'zh-TW',
    workflows: {
      main: {
        title: '主要流程',
        description: '可由流程圖編輯器讀寫的正式 graph workflow。',
        graph: {
          direction: 'TB',
          nodes: orderedNodes.map((node) => toGraphNode(node)),
          edges: edges.map((edge) => toGraphEdge(edge)),
        },
      },
    },
  }
}

export function toGraphNode(node: WorkflowNode) {
  const graphNode: Record<string, unknown> = {
    id: sanitizeStepId(node.id),
    kind: node.data.kind,
    title: node.data.title,
  }
  if (node.data.description.trim()) graphNode.description = node.data.description.trim()
  if (node.data.purpose.trim()) graphNode.purpose = node.data.purpose.trim()
  const instructions = parseLines(node.data.instructions)
  if (instructions.length) graphNode.instructions = instructions
  const decisionRules = parseLines(node.data.decisionRules)
  if (decisionRules.length) graphNode.decision_rules = decisionRules
  if (node.data.input.trim()) graphNode.input = parseInputList(node.data.input)
  if (node.data.output.trim()) graphNode.output = sanitizeStepId(node.data.output)
  if (node.data.branchHandles?.length) graphNode.handles = node.data.branchHandles
  return graphNode
}

export function toGraphEdge(edge: WorkflowEdge) {
  const graphEdge: Record<string, unknown> = {
    from: edge.source,
    to: edge.target,
  }
  const label = edgeLabel(edge)
  if (label) graphEdge.label = label
  if (edge.sourceHandle) graphEdge.sourceHandle = edge.sourceHandle
  if (edge.targetHandle) graphEdge.targetHandle = edge.targetHandle
  return graphEdge
}

export function aiMcStepType(kind: WorkflowNodeKind): string {
  if (kind === 'human_check') return 'code-edit'
  if (kind === 'code_edit') return 'code-edit'
  if (kind === 'shell') return 'shell'
  if (kind === 'tool') return 'tool-or-shell'
  if (kind === 'file' || kind === 'output' || kind === 'terminal') return 'file'
  return 'ai'
}

export function orderWorkflowNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, string[]>()
  const incoming = new Set<string>()
  const visited = new Set<string>()
  const ordered: WorkflowNode[] = []

  for (const edge of edges) {
    if (!edge.source || !edge.target) continue
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
    incoming.add(edge.target)
  }
  for (const [source, targets] of outgoing) {
    outgoing.set(source, sortNodeIdsByPosition(targets, byId))
  }

  function visit(nodeId: string) {
    const node = byId.get(nodeId)
    if (!node || visited.has(nodeId)) return
    visited.add(nodeId)
    ordered.push(node)
    for (const targetId of outgoing.get(nodeId) ?? []) visit(targetId)
  }

  const starts = nodes.filter((node) => node.data.kind === 'start')
  for (const node of sortNodesByPosition(starts)) visit(node.id)

  const rootNodes = nodes.filter((node) => !incoming.has(node.id) && node.data.kind !== 'start')
  for (const node of sortNodesByPosition(rootNodes)) visit(node.id)

  for (const node of sortNodesByPosition(nodes)) visit(node.id)
  return ordered
}

function sortNodeIdsByPosition(ids: string[], nodes: Map<string, WorkflowNode>): string[] {
  return [...ids].sort((left, right) => {
    const leftNode = nodes.get(left)
    const rightNode = nodes.get(right)
    return (leftNode?.position.y ?? 0) - (rightNode?.position.y ?? 0)
      || (leftNode?.position.x ?? 0) - (rightNode?.position.x ?? 0)
  })
}

function sortNodesByPosition(nodes: WorkflowNode[]): WorkflowNode[] {
  return [...nodes].sort((left, right) => (
    left.position.y - right.position.y || left.position.x - right.position.x
  ))
}
