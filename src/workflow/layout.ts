import type { AiMcGraphEdge, AiMcGraphNode } from './types'
import { localizedBranchLabel } from './edges'

export function layoutGraph(graphNodes: AiMcGraphNode[], graphEdges: AiMcGraphEdge[]) {
  const ids = graphNodes.map((node) => node.id)
  const idSet = new Set(ids)
  const nodeOrder = new Map(ids.map((id, index) => [id, index]))
  const outgoing = new Map<string, Array<{ source: string; target: string; label?: string }>>()
  const incoming = new Map<string, Array<{ source: string; target: string; label?: string }>>()

  for (const edge of graphEdges) {
    const source = edge.from ?? edge.source
    const target = edge.to ?? edge.target
    if (!source || !target || !idSet.has(source) || !idSet.has(target)) continue
    const layoutEdge = {
      source,
      target,
      label: edge.branch_label || edge.label || localizedBranchLabel(edge.branch),
    }
    outgoing.set(source, [...(outgoing.get(source) ?? []), layoutEdge])
    incoming.set(target, [...(incoming.get(target) ?? []), layoutEdge])
  }

  const roots = ids.filter((id) => !incoming.has(id))
  const start = roots.sort((left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0))[0] ?? ids[0]
  const primaryPath: string[] = []
  const primaryIndex = new Map<string, number>()
  const primaryEdges = new Map<string, { source: string; target: string; label?: string }>()
  let current = start

  for (let guard = 0; current && guard < ids.length; guard += 1) {
    if (primaryIndex.has(current)) break
    primaryIndex.set(current, primaryPath.length)
    primaryPath.push(current)
    const nextEdge = choosePrimaryLayoutEdge(current, outgoing, incoming, nodeOrder)
    if (!nextEdge) break
    primaryEdges.set(current, nextEdge)
    current = nextEdge.target
  }

  const centerX = 520
  const startY = 80
  const mainGap = 250
  const sideGap = 340
  const branchGap = 165
  const positions = new Map<string, { x: number; y: number }>()
  primaryPath.forEach((id, index) => {
    positions.set(id, { x: centerX, y: startY + index * mainGap })
  })

  for (const id of primaryPath) {
    const edges = outgoing.get(id) ?? []
    const primaryEdge = primaryEdges.get(id)
    const branchEdges = edges.filter((edge) => edge.target !== primaryEdge?.target)
    branchEdges.forEach((edge, index) => {
      const side = branchSide(edge, index)
      placeBranchChain(edge.target, id, side, positions, primaryIndex, outgoing, nodeOrder, sideGap, branchGap)
    })
  }

  ids.forEach((id, index) => {
    if (positions.has(id)) return
    positions.set(id, {
      x: centerX + ((index % 2 === 0 ? -1 : 1) * sideGap),
      y: startY + (primaryPath.length + Math.floor(index / 2)) * mainGap,
    })
  })

  return positions
}

function choosePrimaryLayoutEdge(
  source: string,
  outgoing: Map<string, Array<{ source: string; target: string; label?: string }>>,
  incoming: Map<string, Array<{ source: string; target: string; label?: string }>>,
  nodeOrder: Map<string, number>,
) {
  const edges = outgoing.get(source) ?? []
  if (edges.length <= 1) return edges[0]
  const sortedEdges = sortLayoutEdges(edges, nodeOrder)
  const joinEdge = sortedEdges.find((edge) => (incoming.get(edge.target)?.length ?? 0) > 1)
  if (joinEdge) return joinEdge
  const successEdge = sortedEdges.find((edge) => isSuccessBranch(edge.label))
  return successEdge ?? sortedEdges[0]
}

function sortLayoutEdges<T extends { target: string }>(edges: T[], nodeOrder: Map<string, number>) {
  return [...edges].sort((left, right) => (nodeOrder.get(left.target) ?? 0) - (nodeOrder.get(right.target) ?? 0))
}

function branchSide(
  edge: { label?: string },
  index: number,
) {
  if (isSuccessBranch(edge.label)) return -1
  if (isNegativeBranch(edge.label)) return 1
  return index % 2 === 0 ? -1 : 1
}

function placeBranchChain(
  firstId: string,
  sourceId: string,
  side: number,
  positions: Map<string, { x: number; y: number }>,
  primaryIndex: Map<string, number>,
  outgoing: Map<string, Array<{ source: string; target: string; label?: string }>>,
  nodeOrder: Map<string, number>,
  sideGap: number,
  branchGap: number,
) {
  const sourcePosition = positions.get(sourceId)
  if (!sourcePosition) return
  const visited = new Set<string>()
  let currentId = firstId
  let depth = 1

  while (currentId && !visited.has(currentId) && !primaryIndex.has(currentId)) {
    visited.add(currentId)
    if (!positions.has(currentId)) {
      positions.set(currentId, {
        x: sourcePosition.x + side * sideGap,
        y: sourcePosition.y + depth * branchGap,
      })
    }
    const nextEdges = sortLayoutEdges(outgoing.get(currentId) ?? [], nodeOrder)
    if (nextEdges.length !== 1) break
    currentId = nextEdges[0].target
    depth += 1
  }
}

function isSuccessBranch(label: string | undefined) {
  const normalized = normalizeBranchLabel(label)
  return normalized === 'yes' || normalized === 'pass'
}

function isNegativeBranch(label: string | undefined) {
  const normalized = normalizeBranchLabel(label)
  return normalized === 'no' || normalized === 'loop'
}

function normalizeBranchLabel(label: string | undefined) {
  if (!label) return ''
  if (label === '是') return 'yes'
  if (label === '否') return 'no'
  if (label === '通過') return 'pass'
  if (label === '回圈') return 'loop'
  return label.trim().toLowerCase()
}
