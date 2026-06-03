import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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
  Code2,
  FileInput,
  FileText,
  GitBranch,
  Hand,
  Moon,
  PanelRight,
  Plus,
  RotateCcw,
  Route,
  Square,
  Sun,
  Terminal,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react'
import YAML from 'yaml'

import { toAiMcWorkflowSpec, toGraphWorkflowSpec } from './workflow/convert'
import { defaultEdgeOptions, edgeLabel, edgeOptionsForConnection } from './workflow/edges'
import { localizeWorkflowTerm } from './workflow/localization'
import { parseAiMcWorkflow, workflowNamesFromText } from './workflow/parse'
import { createCanvasBackup, parseCanvasBackup, readCanvasStateFromStorage, writeCanvasStateToStorage } from './workflow/persistence'
import { defaultConditionBranchHandles, initialEdges, initialNodes, nodeColor, nodeTemplateMetadata, nodeTypeLabels, toolboxGroups } from './workflow/templates'
import type { PersistedCanvasState } from './workflow/persistence'
import type { EditableField, PreviewMode, ThemeMode, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from './workflow/types'

const nodeTemplateIcons: Record<WorkflowNodeKind, typeof Circle> = {
  start: Circle,
  ai_task: Bot,
  condition: GitBranch,
  human_check: Hand,
  output: Square,
  shell: Terminal,
  tool: Wrench,
  file: FileText,
  code_edit: Code2,
  terminal: Terminal,
}

const nodeTemplates: Array<{
  kind: WorkflowNodeKind
  title: string
  description: string
  icon: typeof Circle
}> = nodeTemplateMetadata.map((template) => ({
  ...template,
  icon: nodeTemplateIcons[template.kind],
}))

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

const defaultCanvasState: PersistedCanvasState = {
  nodes: initialNodes,
  edges: initialEdges,
  selectedWorkflowName: '',
  previewMode: 'aiMc',
  themeMode: 'dark',
}

function readInitialCanvasState() {
  if (typeof window === 'undefined') return defaultCanvasState
  return readCanvasStateFromStorage(window.localStorage) ?? defaultCanvasState
}

function canvasContentSignature(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  return JSON.stringify({
    nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
    edges: edges.map(({ id, source, sourceHandle, target, targetHandle, label, data }) => ({
      id,
      source,
      sourceHandle,
      target,
      targetHandle,
      label,
      data,
    })),
  })
}

export function App() {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  )
}

function WorkflowEditor() {
  const initialCanvasState = useMemo(() => readInitialCanvasState(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(initialCanvasState.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(initialCanvasState.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialCanvasState.nodes[0]?.id ?? '')
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [previewMode, setPreviewMode] = useState<PreviewMode>(initialCanvasState.previewMode)
  const [previewActionMessage, setPreviewActionMessage] = useState('')
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importWorkflowNames, setImportWorkflowNames] = useState<string[]>([])
  const [currentWorkflowName, setCurrentWorkflowName] = useState(initialCanvasState.selectedWorkflowName)
  const [selectedImportWorkflow, setSelectedImportWorkflow] = useState(initialCanvasState.selectedWorkflowName)
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialCanvasState.themeMode)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { fitView, screenToFlowPosition } = useReactFlow<WorkflowNode, WorkflowEdge>()

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const canvasPreview = useMemo(() => createCanvasBackup({
    nodes,
    edges,
    selectedWorkflowName: currentWorkflowName,
    previewMode,
    themeMode,
  }), [currentWorkflowName, edges, nodes, previewMode, themeMode])
  const aiMcPreview = useMemo(() => JSON.stringify(toAiMcWorkflowSpec(nodes, edges), null, 2), [edges, nodes])
  const graphPreview = useMemo(() => YAML.stringify(toGraphWorkflowSpec(nodes, edges)), [edges, nodes])
  const previewByMode = useCallback((mode: PreviewMode) => {
    switch (mode) {
      case 'aiMc':
        return aiMcPreview
      case 'graph':
        return graphPreview
      case 'canvas':
        return canvasPreview
    }
  }, [aiMcPreview, canvasPreview, graphPreview])
  const activePreview = previewByMode(previewMode)

  useEffect(() => {
    if (typeof window === 'undefined') return
    writeCanvasStateToStorage(window.localStorage, {
      nodes,
      edges,
      selectedWorkflowName: currentWorkflowName,
      previewMode,
      themeMode,
    })
  }, [currentWorkflowName, edges, nodes, previewMode, themeMode])

  function copyPreviewWithFallback(value: string) {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)

    try {
      textarea.select()
      return document.execCommand('copy')
    } finally {
      document.body.removeChild(textarea)
    }
  }

  async function copyActivePreview() {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(activePreview)
          setPreviewActionMessage('已複製目前預覽。')
          return
        } catch {
          // Some browsers expose Clipboard API but reject it outside secure contexts.
        }
      }

      if (!copyPreviewWithFallback(activePreview)) {
        throw new Error('Clipboard fallback failed')
      }

      setPreviewActionMessage('已複製目前預覽。')
    } catch {
      setPreviewActionMessage('複製失敗，請改用手動選取。')
    }
  }

  function downloadPreview(mode: PreviewMode) {
    const filenames: Record<PreviewMode, string> = {
      aiMc: 'ai-mc-workflow.json',
      graph: 'graph-workflow.yaml',
      canvas: 'canvas-workflow.json',
    }
    const mimeTypes: Record<PreviewMode, string> = {
      aiMc: 'application/json',
      graph: 'application/x-yaml',
      canvas: 'application/json',
    }
    const filename = filenames[mode]
    let url = ''
    let link: HTMLAnchorElement | null = null

    try {
      const blob = new Blob([previewByMode(mode)], { type: `${mimeTypes[mode]};charset=utf-8` })
      url = URL.createObjectURL(blob)
      link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      setPreviewActionMessage(`已下載 ${filename}。`)
    } catch {
      setPreviewActionMessage(`下載 ${filename} 失敗。`)
    } finally {
      link?.remove()
      if (url) {
        window.setTimeout(() => URL.revokeObjectURL(url), 0)
      }
    }
  }

  function hasEditedCanvas() {
    return canvasContentSignature(nodes, edges) !== canvasContentSignature(initialNodes, initialEdges)
  }

  function confirmCanvasOverwrite(action: string) {
    if (!hasEditedCanvas()) return true
    return window.confirm(`${action}會覆蓋目前畫布內容。要繼續嗎？`)
  }

  function fitCanvasAfterReplace() {
    window.requestAnimationFrame(() => {
      void fitView({ duration: 360, padding: 0.22 })
    })
  }

  function applyCanvasState(nextState: PersistedCanvasState, message: string) {
    if (!confirmCanvasOverwrite('匯入')) {
      setImportMessage('已取消匯入。')
      return
    }

    setNodes(nextState.nodes)
    setEdges(nextState.edges)
    setSelectedNodeId(nextState.nodes[0]?.id ?? '')
    setPreviewMode(nextState.previewMode)
    setThemeMode(nextState.themeMode)
    setImportWorkflowNames([])
    setCurrentWorkflowName(nextState.selectedWorkflowName)
    setSelectedImportWorkflow(nextState.selectedWorkflowName)
    setImportMessage(message)
    fitCanvasAfterReplace()
  }

  function importCanvasBackup() {
    const parsed = parseCanvasBackup(importText)
    if (!parsed) {
      setImportMessage('這不是可匯入的畫布備份 JSON。')
      return
    }

    applyCanvasState(parsed, `已匯入畫布備份：${parsed.nodes.length} 個節點 / ${parsed.edges.length} 條線`)
  }

  function clearCanvas() {
    if (!confirmCanvasOverwrite('清空')) return
    setNodes([])
    setEdges([])
    setSelectedNodeId('')
    setCurrentWorkflowName('')
    setSelectedImportWorkflow('')
    setPreviewActionMessage('已清空畫布。')
  }

  function restoreInitialCanvas() {
    if (!confirmCanvasOverwrite('還原初始畫布')) return
    setNodes(initialNodes)
    setEdges(initialEdges)
    setSelectedNodeId(initialNodes[0]?.id ?? '')
    setCurrentWorkflowName('')
    setSelectedImportWorkflow('')
    setPreviewMode('aiMc')
    setPreviewActionMessage('已還原初始畫布。')
    fitCanvasAfterReplace()
  }

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
      if (!confirmCanvasOverwrite('匯入')) {
        setImportMessage('已取消匯入。')
        return
      }
      setNodes(imported.nodes)
      setEdges(imported.edges)
      setSelectedNodeId(imported.nodes[0]?.id ?? '')
      setPreviewMode('aiMc')
      setImportWorkflowNames(nextWorkflowNames)
      setCurrentWorkflowName(imported.workflowName)
      setSelectedImportWorkflow(imported.workflowName)
      setImportMessage(`已匯入 ${localizeWorkflowTerm(imported.workflowName)}：${imported.stepCount} 個步驟`)
      fitCanvasAfterReplace()
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
      const canvasBackup = parseCanvasBackup(content)
      if (canvasBackup) {
        applyCanvasState(canvasBackup, `已匯入畫布備份：${canvasBackup.nodes.length} 個節點 / ${canvasBackup.edges.length} 條線`)
        return
      }

      const names = workflowNamesFromText(content)
      const firstWorkflow = names[0] ?? ''
      setImportWorkflowNames(names)
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
              <button type="button" onClick={importCanvasBackup} disabled={!importText.trim()}>
                <Upload size={14} />
                畫布備份
              </button>
            </div>
            {importMessage && <p>{importMessage}</p>}
          </section>
        )}

        <div className="toolbox-list">
          {toolboxGroups.map((group) => (
            <section className="toolbox-group" key={group.title} aria-label={`${group.title}節點`}>
              <span>{group.title}</span>
              {group.kinds.map((kind) => {
                const template = nodeTemplates.find((item) => item.kind === kind) ?? nodeTemplates[1]
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
            </section>
          ))}
        </div>
      </aside>

      <section className="canvas-panel" aria-label="流程圖畫布">
        <div className="canvas-actions">
          <button type="button" onClick={() => void fitView({ duration: 320, padding: 0.22 })}>
            <Route size={15} />
            整理畫面
          </button>
          <button type="button" onClick={restoreInitialCanvas}>
            <RotateCcw size={15} />
            還原初始
          </button>
          <button type="button" onClick={clearCanvas}>
            <Trash2 size={15} />
            清空
          </button>
        </div>
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
          <div className="preview-controls">
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
            <div className="preview-actions" aria-label="預覽操作">
              <button type="button" onClick={() => void copyActivePreview()}>
                複製目前預覽
              </button>
              <button type="button" onClick={() => downloadPreview('aiMc')}>
                下載 ai-mc JSON
              </button>
              <button type="button" onClick={() => downloadPreview('graph')}>
                下載 graph YAML
              </button>
              <button type="button" onClick={() => downloadPreview('canvas')}>
                下載畫布 JSON
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
        </div>
        {previewActionMessage && (
          <p className="preview-action-message" role="status">
            {previewActionMessage}
          </p>
        )}
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
