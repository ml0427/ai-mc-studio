import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnReconnect,
} from '@xyflow/react'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Circle,
  FileInput,
  GitBranch,
  Hand,
  PanelRight,
  Plus,
  Route,
  Square,
} from 'lucide-react'
import YAML from 'yaml'

type WorkflowNodeKind = 'start' | 'ai_task' | 'condition' | 'human_check' | 'output'

type WorkflowNodeData = {
  kind: WorkflowNodeKind
  title: string
  description: string
  input: string
  output: string
}

type WorkflowNode = Node<WorkflowNodeData, 'workflowNode'>
type WorkflowEdge = Edge
type EditableField = keyof Pick<WorkflowNodeData, 'title' | 'description' | 'input' | 'output'>
type PreviewMode = 'aiMc' | 'canvas'

type AiMcWorkflowStep = {
  id: string
  type: string
  title?: string
  description?: string
  when?: string
  input?: string | string[]
  output?: string
  blocks_downstream?: boolean
}

type AiMcWorkflowSpec = {
  schema_version?: string
  name?: string
  description?: string
  workflows?: Record<string, {
    description?: string
    steps?: AiMcWorkflowStep[]
  }>
}

const nodeTemplates: Array<{
  kind: WorkflowNodeKind
  title: string
  description: string
  icon: typeof Circle
}> = [
  { kind: 'start', title: '起點', description: '流程從這裡開始。', icon: Circle },
  { kind: 'ai_task', title: 'AI 任務', description: '請 AI 做一件事，例如整理、判斷或產生內容。', icon: Bot },
  { kind: 'condition', title: '條件分支', description: '根據條件決定下一步要走哪條路。', icon: GitBranch },
  { kind: 'human_check', title: '人工確認', description: '暫停一下，讓人確認後再繼續。', icon: Hand },
  { kind: 'output', title: '輸出結果', description: '整理最後要留下或交付的內容。', icon: Square },
]

const nodeTypeLabels: Record<WorkflowNodeKind, string> = {
  start: '起點',
  ai_task: 'AI 任務',
  condition: '條件',
  human_check: '人工確認',
  output: '輸出',
}

const initialNodes: WorkflowNode[] = [
  {
    id: 'start-1',
    type: 'workflowNode',
    position: { x: 120, y: 120 },
    data: {
      kind: 'start',
      title: '起點',
      description: '流程從這裡開始。',
      input: '',
      output: 'start',
    },
  },
]

const initialEdges: WorkflowEdge[] = []
const nodeTypes = { workflowNode: WorkflowNodeCard }
const defaultEdgeOptions = {
  animated: true,
  reconnectable: true,
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    color: '#8fffe0',
  },
  style: {
    stroke: '#8fffe0',
    strokeWidth: 2.5,
  },
} satisfies Partial<WorkflowEdge>

const sampleImport = `schema_version: "1"
name: sample-flow
description: 匯入測試
workflows:
  main:
    description: 主要流程
    steps:
      - id: collect_context
        type: ai
        output: context
      - id: decide_path
        type: ai
        when: context needs review
        input: context
        output: decision
      - id: final_output
        type: file
        input: decision
        output: report
`

export function App() {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  )
}

function WorkflowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string>('start-1')
  const [showJsonPreview, setShowJsonPreview] = useState(true)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('aiMc')
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { fitView, screenToFlowPosition } = useReactFlow<WorkflowNode, WorkflowEdge>()

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const canvasPreview = useMemo(() => JSON.stringify({
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, sourceHandle, target, targetHandle, markerEnd, reconnectable }) => ({
      id,
      source,
      sourceHandle,
      target,
      targetHandle,
      markerEnd,
      reconnectable,
    })),
  }, null, 2), [edges, nodes])
  const aiMcPreview = useMemo(() => JSON.stringify(toAiMcWorkflowSpec(nodes, edges), null, 2), [edges, nodes])
  const activePreview = previewMode === 'aiMc' ? aiMcPreview : canvasPreview

  const onConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((node) => node.id === connection.source)
    setEdges((currentEdges) => addEdge({
      ...connection,
      ...edgeOptionsForConnection(sourceNode?.data.kind, connection.sourceHandle),
      id: `${connection.source}:${connection.sourceHandle}->${connection.target}:${connection.targetHandle}`,
    }, currentEdges))
  }, [nodes, setEdges])

  const onReconnect = useCallback<OnReconnect<WorkflowEdge>>((oldEdge, newConnection) => {
    const sourceNode = nodes.find((node) => node.id === newConnection.source)
    const nextEdge = {
      ...oldEdge,
      ...newConnection,
      ...edgeOptionsForConnection(sourceNode?.data.kind, newConnection.sourceHandle),
      id: `${newConnection.source}:${newConnection.sourceHandle}->${newConnection.target}:${newConnection.targetHandle}`,
    }
    setEdges((currentEdges) => reconnectEdge(oldEdge, nextEdge, currentEdges))
  }, [nodes, setEdges])

  function addNode(kind: WorkflowNodeKind) {
    const template = nodeTemplates.find((item) => item.kind === kind) ?? nodeTemplates[1]
    const nextNumber = nodes.filter((node) => node.data.kind === kind).length + 1
    const id = `${kind}-${nextNumber}`
    const position = screenToFlowPosition({
      x: 360 + (nodes.length % 3) * 70,
      y: 180 + (nodes.length % 4) * 55,
    })

    const nextNode: WorkflowNode = {
      id,
      type: 'workflowNode',
      position,
      data: {
        kind,
        title: template.title,
        description: template.description,
        input: '',
        output: kind === 'start' ? 'start' : id,
      },
    }

    setNodes((currentNodes) => [...currentNodes, nextNode])
    setSelectedNodeId(id)
  }

  function importAiMcWorkflow() {
    try {
      const imported = parseAiMcWorkflow(importText)
      setNodes(imported.nodes)
      setEdges(imported.edges)
      setSelectedNodeId(imported.nodes[0]?.id ?? '')
      setPreviewMode('aiMc')
      setShowJsonPreview(true)
      setImportMessage(`已匯入 ${imported.workflowName}：${imported.stepCount} 個步驟`)
      window.requestAnimationFrame(() => {
        void fitView({ duration: 360, padding: 0.22 })
      })
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '匯入失敗，請檢查格式。')
    }
  }

  async function loadImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      setImportText(content)
      setImportMessage(`已讀取 ${file.name}，按「匯入」套用到畫布。`)
    } catch {
      setImportMessage('讀取檔案失敗，請改用貼上文字。')
    } finally {
      event.target.value = ''
    }
  }

  function updateSelectedNode(field: EditableField, value: string) {
    if (!selectedNode) return
    setNodes((currentNodes) => currentNodes.map((node) => (
      node.id === selectedNode.id
        ? { ...node, data: { ...node.data, [field]: value } }
        : node
    )))
  }

  return (
    <main className={`app-shell ${showJsonPreview ? '' : 'json-hidden'}`}>
      <aside className="toolbox-panel" aria-label="節點工具箱">
        <div className="brand-block">
          <Route size={24} />
          <div>
            <span>AI 流程圖</span>
            <strong>拖拉式編輯器</strong>
          </div>
        </div>

        <button
          className="import-toggle"
          type="button"
          onClick={() => setShowImportPanel((current) => !current)}
        >
          <FileInput size={16} />
          匯入 ai-mc
        </button>

        {showImportPanel && (
          <section className="import-panel" aria-label="匯入 ai-mc workflow">
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              accept=".yaml,.yml,.json,application/json,text/yaml,text/x-yaml"
              onChange={(event) => void loadImportFile(event)}
            />
            <textarea
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value)
                setImportMessage('')
              }}
              placeholder="貼上 workflow.yaml 或 JSON"
              spellCheck={false}
            />
            <div className="import-actions">
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                選檔案
              </button>
              <button type="button" onClick={() => setImportText(sampleImport)}>
                放範例
              </button>
              <button type="button" onClick={importAiMcWorkflow} disabled={!importText.trim()}>
                匯入
              </button>
            </div>
            {importMessage && <p>{importMessage}</p>}
          </section>
        )}

        <div className="toolbox-list">
          {nodeTemplates.map((template) => {
            const Icon = template.icon
            return (
              <button
                className={`toolbox-node type-${template.kind}`}
                key={template.kind}
                type="button"
                onClick={() => addNode(template.kind)}
              >
                <Icon size={18} />
                <span>
                  <strong>{template.title}</strong>
                  <small>{template.description}</small>
                </span>
                <Plus size={16} />
              </button>
            )
          })}
        </div>
      </aside>

      <section className="canvas-panel" aria-label="流程圖畫布">
        <button className="fit-view-button" type="button" onClick={() => void fitView({ duration: 320, padding: 0.22 })}>
          整理畫面
        </button>
        <ReactFlow
          colorMode="dark"
          defaultEdgeOptions={defaultEdgeOptions}
          edges={edges}
          edgesReconnectable
          fitView
          nodes={nodes}
          nodeTypes={nodeTypes}
          reconnectRadius={10}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId('')}
          onReconnect={onReconnect}
        >
          <Background color="#273248" gap={28} />
          <Controls position="top-right" />
          <MiniMap
            maskColor="rgba(7, 10, 18, 0.72)"
            nodeColor={(node) => nodeColor((node as WorkflowNode).data.kind)}
            pannable
            zoomable
          />
        </ReactFlow>
      </section>

      <aside className="settings-panel" aria-label="節點設定">
        <div className="panel-title">
          <PanelRight size={18} />
          <strong>節點設定</strong>
        </div>

        {selectedNode ? (
          <form className="settings-form">
            <div className={`kind-pill type-${selectedNode.data.kind}`}>
              {nodeTypeLabels[selectedNode.data.kind]}
            </div>
            <label>
              <span>標題</span>
              <input
                value={selectedNode.data.title}
                onChange={(event) => updateSelectedNode('title', event.target.value)}
              />
            </label>
            <label>
              <span>說明</span>
              <textarea
                value={selectedNode.data.description}
                onChange={(event) => updateSelectedNode('description', event.target.value)}
              />
            </label>
            <label>
              <span>輸入</span>
              <input
                value={selectedNode.data.input}
                onChange={(event) => updateSelectedNode('input', event.target.value)}
                placeholder="例如：上一個節點的輸出"
              />
            </label>
            <label>
              <span>輸出</span>
              <input
                value={selectedNode.data.output}
                onChange={(event) => updateSelectedNode('output', event.target.value)}
                placeholder={selectedNode.id}
              />
            </label>
          </form>
        ) : (
          <div className="empty-settings">
            <strong>還沒選節點</strong>
            <span>點一下畫布上的節點，就能在這裡編輯內容。</span>
          </div>
        )}
      </aside>

      <section className="json-panel" aria-label="目前流程資料">
        <div className="json-title">
          <div>
            <strong>{previewMode === 'aiMc' ? 'ai-mc workflow 預覽' : '畫布資料'}</strong>
            <span>{nodes.length} 個節點 / {edges.length} 條線</span>
          </div>
          <div className="preview-mode-tabs" role="tablist" aria-label="預覽格式">
            <button
              aria-selected={previewMode === 'aiMc'}
              role="tab"
              type="button"
              onClick={() => setPreviewMode('aiMc')}
            >
              ai-mc 格式
            </button>
            <button
              aria-selected={previewMode === 'canvas'}
              role="tab"
              type="button"
              onClick={() => setPreviewMode('canvas')}
            >
              畫布資料
            </button>
          </div>
          <button
            className="json-toggle"
            aria-expanded={showJsonPreview}
            type="button"
            onClick={() => setShowJsonPreview((current) => !current)}
          >
            {showJsonPreview ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            {showJsonPreview ? '隱藏下方欄位' : '顯示下方欄位'}
          </button>
        </div>
        {showJsonPreview && <pre>{activePreview}</pre>}
      </section>
    </main>
  )
}

function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowNode>) {
  if (data.kind === 'condition') {
    return (
      <article className={`workflow-node type-${data.kind} ${selected ? 'selected' : ''}`}>
        <Handle id="top" type="target" position={Position.Top} />
        <Handle id="right" type="source" position={Position.Right} />
        <Handle id="bottom" type="source" position={Position.Bottom} />
        <Handle id="left" type="target" position={Position.Left} />

        <span className="branch-label branch-yes">是</span>
        <span className="branch-label branch-no">否</span>
        <div className="condition-node-content">
          <span>{nodeTypeLabels[data.kind]}</span>
          <strong>{data.title || '條件分支'}</strong>
          <p>{data.description || '填入判斷條件'}</p>
        </div>
      </article>
    )
  }

  return (
    <article className={`workflow-node type-${data.kind} ${selected ? 'selected' : ''}`}>
      <Handle id="top" type="target" position={Position.Top} />
      <Handle id="right" type="source" position={Position.Right} />
      <Handle id="bottom" type="source" position={Position.Bottom} />
      <Handle id="left" type="target" position={Position.Left} />

      <div className="node-header">
        <span>{nodeTypeLabels[data.kind]}</span>
        <strong>{data.title || '未命名'}</strong>
      </div>
      <p>{data.description || '還沒有說明'}</p>
    </article>
  )
}

function nodeColor(kind: WorkflowNodeKind): string {
  if (kind === 'start') return '#89f7fe'
  if (kind === 'ai_task') return '#a78bfa'
  if (kind === 'condition') return '#fbbf24'
  if (kind === 'human_check') return '#34d399'
  return '#38bdf8'
}

function toAiMcWorkflowSpec(nodes: WorkflowNode[], edges: WorkflowEdge[]): AiMcWorkflowSpec {
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

function toAiMcStep(node: WorkflowNode): AiMcWorkflowStep {
  const step: AiMcWorkflowStep = {
    id: sanitizeStepId(node.id),
    type: aiMcStepType(node.data.kind),
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

function parseAiMcWorkflow(value: string): {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  stepCount: number
  workflowName: string
} {
  const parsed = parseWorkflowText(value)
  const workflows = parsed.workflows ?? {}
  const workflowName = workflows.main ? 'main' : Object.keys(workflows)[0]
  const workflow = workflowName ? workflows[workflowName] : null
  const steps = workflow?.steps ?? []

  if (!workflow || !Array.isArray(steps)) {
    throw new Error('找不到 workflows 裡面的 steps，請貼上 ai-mc workflow.yaml 或 JSON。')
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
  const template = nodeTemplates.find((item) => item.kind === kind) ?? nodeTemplates[1]
  return {
    id: sanitizeStepId(step.id),
    type: 'workflowNode',
    position: {
      x: 420 + (index % 2) * 280,
      y: 120 + index * 150,
    },
    data: {
      kind,
      title: step.title || template.title,
      description: step.description || step.when || template.description,
      input: normalizeInput(step.input),
      output: step.output || step.id,
    },
  }
}

function aiMcKindFromStep(step: AiMcWorkflowStep): WorkflowNodeKind {
  if (step.blocks_downstream) return 'human_check'
  if (step.type === 'file') return 'output'
  if (step.when) return 'condition'
  return 'ai_task'
}

function makeWorkflowEdge(source: string, target: string, sourceKind?: WorkflowNodeKind): WorkflowEdge {
  return {
    ...edgeOptionsForConnection(sourceKind, 'right'),
    id: `${source}:right->${target}:left`,
    source,
    sourceHandle: 'right',
    target,
    targetHandle: 'left',
  }
}

function edgeOptionsForConnection(sourceKind?: WorkflowNodeKind, sourceHandle?: string | null): Partial<WorkflowEdge> {
  if (sourceKind !== 'condition') return defaultEdgeOptions

  const label = sourceHandle === 'bottom' ? '否' : '是'
  return {
    ...defaultEdgeOptions,
    label,
    labelStyle: {
      fill: '#07111f',
      fontSize: 12,
      fontWeight: 900,
    },
    labelBgStyle: {
      fill: '#ffd166',
      fillOpacity: 1,
    },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 999,
  }
}

function aiMcStepType(kind: WorkflowNodeKind): string {
  if (kind === 'human_check') return 'code-edit'
  if (kind === 'output') return 'file'
  return 'ai'
}

function orderWorkflowNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
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

function parseInputList(value: string): string | string[] {
  const parts = value.split(',').map((item) => item.trim()).filter(Boolean)
  return parts.length > 1 ? parts : value.trim()
}

function normalizeInput(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(', ')
  return value ?? ''
}

function sanitizeStepId(value: string): string {
  const safe = value.trim().replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_')
  return safe || 'step'
}
