import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
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
  Moon,
  PanelRight,
  Plus,
  Route,
  Square,
  Sun,
} from 'lucide-react'
import YAML from 'yaml'

import { toAiMcWorkflowSpec, toGraphWorkflowSpec } from './workflow/convert'
import { defaultEdgeOptions, edgeLabel, edgeOptionsForConnection } from './workflow/edges'
import { localizeWorkflowTerm } from './workflow/localization'
import { parseAiMcWorkflow, workflowNamesFromText } from './workflow/parse'
import { defaultConditionBranchHandles, initialEdges, initialNodes, nodeColor, nodeTypeLabels } from './workflow/templates'
import type { EditableField, PreviewMode, ThemeMode, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from './workflow/types'

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

const nodeTypes = { workflowNode: WorkflowNodeCard }

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
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('aiMc')
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importWorkflowNames, setImportWorkflowNames] = useState<string[]>([])
  const [selectedImportWorkflow, setSelectedImportWorkflow] = useState('')
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { fitView, screenToFlowPosition } = useReactFlow<WorkflowNode, WorkflowEdge>()

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const canvasPreview = useMemo(() => JSON.stringify({
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, sourceHandle, target, targetHandle, label, data, markerEnd, reconnectable }) => ({
      id,
      source,
      sourceHandle,
      target,
      targetHandle,
      label,
      data,
      markerEnd,
      reconnectable,
    })),
  }, null, 2), [edges, nodes])
  const aiMcPreview = useMemo(() => JSON.stringify(toAiMcWorkflowSpec(nodes, edges), null, 2), [edges, nodes])
  const graphPreview = useMemo(() => YAML.stringify(toGraphWorkflowSpec(nodes, edges)), [edges, nodes])
  const activePreview = previewMode === 'aiMc'
    ? aiMcPreview
    : previewMode === 'graph' ? graphPreview : canvasPreview

  const onConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((node) => node.id === connection.source)
    setEdges((currentEdges) => addEdge({
      ...connection,
      ...edgeOptionsForConnection(
        sourceNode?.data.kind,
        connection.sourceHandle,
        undefined,
        sourceNode?.data.branchHandles,
      ),
      id: `${connection.source}:${connection.sourceHandle}->${connection.target}:${connection.targetHandle}`,
    }, currentEdges))
  }, [nodes, setEdges])

  const onReconnect = useCallback<OnReconnect<WorkflowEdge>>((oldEdge, newConnection) => {
    const sourceNode = nodes.find((node) => node.id === newConnection.source)
    const preservedLabel = oldEdge.source === newConnection.source && oldEdge.sourceHandle === newConnection.sourceHandle
      ? edgeLabel(oldEdge)
      : undefined
    const nextEdgeOptions = edgeOptionsForConnection(
      sourceNode?.data.kind,
      newConnection.sourceHandle,
      preservedLabel,
      sourceNode?.data.branchHandles,
    )
    const nextEdge = {
      ...oldEdge,
      label: undefined,
      labelStyle: undefined,
      labelBgStyle: undefined,
      labelBgPadding: undefined,
      labelBgBorderRadius: undefined,
      data: undefined,
      ...newConnection,
      ...nextEdgeOptions,
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
        purpose: '',
        instructions: '',
        decisionRules: '',
        input: '',
        output: kind === 'start' ? 'start' : id,
      },
    }

    setNodes((currentNodes) => [...currentNodes, nextNode])
    setSelectedNodeId(id)
  }

  function applyImportedWorkflow(value: string, workflowName = selectedImportWorkflow) {
    try {
      const nextWorkflowNames = workflowNamesFromText(value)
      const nextWorkflowName = workflowName && nextWorkflowNames.includes(workflowName)
        ? workflowName
        : nextWorkflowNames[0] ?? ''
      const imported = parseAiMcWorkflow(value, nextWorkflowName)
      setNodes(imported.nodes)
      setEdges(imported.edges)
      setSelectedNodeId(imported.nodes[0]?.id ?? '')
      setPreviewMode('aiMc')
      setImportWorkflowNames(nextWorkflowNames)
      setSelectedImportWorkflow(imported.workflowName)
      setImportMessage(`已匯入 ${localizeWorkflowTerm(imported.workflowName)}：${imported.stepCount} 個步驟`)
      window.requestAnimationFrame(() => {
        void fitView({ duration: 360, padding: 0.22 })
      })
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '匯入失敗，請檢查格式。')
    }
  }

  function importAiMcWorkflow() {
    applyImportedWorkflow(importText)
  }

  async function loadImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      setImportText(content)
      const names = workflowNamesFromText(content)
      const firstWorkflow = names[0] ?? ''
      setImportWorkflowNames(names)
      setSelectedImportWorkflow(firstWorkflow)
      applyImportedWorkflow(content, firstWorkflow)
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
    <main className={`app-shell theme-${themeMode} ${showJsonPreview ? '' : 'json-hidden'}`}>
      <aside className="toolbox-panel" aria-label="節點工具箱">
        <div className="brand-block">
          <Route size={24} />
          <div>
            <span>AI 流程圖</span>
            <strong>拖拉式編輯器</strong>
          </div>
        </div>

        <button
          className="theme-toggle"
          type="button"
          onClick={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
        >
          {themeMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {themeMode === 'dark' ? '亮色' : '暗色'}
        </button>

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
                const nextValue = event.target.value
                setImportText(nextValue)
                const names = workflowNamesFromText(nextValue)
                setImportWorkflowNames(names)
                setSelectedImportWorkflow((current) => (
                  current && names.includes(current) ? current : names[0] ?? ''
                ))
                setImportMessage('')
              }}
              placeholder="貼上 workflow.yaml 或 JSON"
              spellCheck={false}
            />
            {importWorkflowNames.length > 1 && (
              <label className="workflow-picker">
                <span>路線</span>
                <select
                  value={selectedImportWorkflow}
                  onChange={(event) => {
                    const nextWorkflow = event.target.value
                    setSelectedImportWorkflow(nextWorkflow)
                    applyImportedWorkflow(importText, nextWorkflow)
                  }}
                >
                  {importWorkflowNames.map((name) => (
                    <option key={name} value={name}>{localizeWorkflowTerm(name)}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="import-actions">
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                選檔案
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportText(sampleImport)
                  const names = workflowNamesFromText(sampleImport)
                  setImportWorkflowNames(names)
                  setSelectedImportWorkflow(names[0] ?? '')
                }}
              >
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
          colorMode={themeMode}
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
          <Background color={themeMode === 'dark' ? '#273248' : '#cbd5e1'} gap={28} />
          <Controls position="top-right" />
          <MiniMap
            maskColor={themeMode === 'dark' ? 'rgba(7, 10, 18, 0.72)' : 'rgba(226, 232, 240, 0.58)'}
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
              <span>目的</span>
              <textarea
                value={selectedNode.data.purpose}
                onChange={(event) => updateSelectedNode('purpose', event.target.value)}
                placeholder="這一步為什麼存在？它要幫後續流程解決什麼問題？"
              />
            </label>
            <label>
              <span>執行指示</span>
              <textarea
                value={selectedNode.data.instructions}
                onChange={(event) => updateSelectedNode('instructions', event.target.value)}
                placeholder="一行一個指示，例如：整理成白話、列出驗收條件"
              />
            </label>
            <label>
              <span>判斷規則</span>
              <textarea
                value={selectedNode.data.decisionRules}
                onChange={(event) => updateSelectedNode('decisionRules', event.target.value)}
                placeholder="條件節點用：什麼情況走是？什麼情況走否？"
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
            <strong>
              {previewMode === 'aiMc'
                ? 'ai-mc workflow 預覽'
                : previewMode === 'graph' ? 'graph YAML 預覽' : '畫布資料'}
            </strong>
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
              aria-selected={previewMode === 'graph'}
              role="tab"
              type="button"
              onClick={() => setPreviewMode('graph')}
            >
              graph YAML
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
    const branchHandles = data.branchHandles?.length
      ? data.branchHandles
      : defaultConditionBranchHandles

    return (
      <article className={`workflow-node type-${data.kind} split-branch ${selected ? 'selected' : ''}`}>
        <Handle id="top" type="target" position={Position.Top} />
        <>
          {branchHandles.map((handle, index) => (
            <Handle
              id={handle.id}
              key={handle.id}
              type="source"
              position={Position.Bottom}
              style={{ left: `${branchHandleLeft(index, branchHandles.length)}%` }}
            />
          ))}
        </>
        <div className="condition-node-content">
          <span>{nodeTypeLabels[data.kind]}</span>
          <strong>{data.title || '條件分支'}</strong>
        </div>
      </article>
    )
  }

  return (
    <article className={`workflow-node type-${data.kind} ${selected ? 'selected' : ''}`}>
      <Handle id="top" type="target" position={Position.Top} />
      <Handle id="bottom" type="source" position={Position.Bottom} />

      <div className="node-header">
        <span>{nodeTypeLabels[data.kind]}</span>
        <strong>{data.title || '未命名'}</strong>
      </div>
    </article>
  )
}

function branchHandleLeft(index: number, count: number) {
  if (count <= 1) return 50
  if (count === 2) return index === 0 ? 32 : 68
  return ((index + 1) / (count + 1)) * 100
}
