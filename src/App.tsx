import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  addEdge,
  ReactFlowProvider,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type OnReconnect,
} from '@xyflow/react'
import YAML from 'yaml'

import { CanvasPanel } from './components/CanvasPanel'
import { ConfirmationDialog } from './components/ConfirmationDialog'
import { PreviewPanel } from './components/PreviewPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { ToolboxPanel } from './components/ToolboxPanel'
import { toAiMcWorkflowSpec, toGraphWorkflowSpec } from './workflow/convert'
import { edgeLabel, edgeOptionsForConnection } from './workflow/edges'
import { localizeWorkflowTerm } from './workflow/localization'
import { parseAiMcWorkflow, workflowNamesFromText } from './workflow/parse'
import { createCanvasBackup, parseCanvasBackup, readCanvasStateFromStorage, writeCanvasStateToStorage } from './workflow/persistence'
import { initialEdges, initialNodes, nodeTemplateMetadata } from './workflow/templates'
import type { PersistedCanvasState } from './workflow/persistence'
import type { EditableField, PreviewMode, ThemeMode, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from './workflow/types'

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

type ConfirmationRequest = {
  action: string
  onConfirm: () => void
  onCancel?: () => void
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
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null)
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

  function requestCanvasOverwrite(action: string, onConfirm: () => void, onCancel?: () => void) {
    if (!hasEditedCanvas()) {
      onConfirm()
      return
    }

    setConfirmationRequest({ action, onConfirm, onCancel })
  }

  function cancelConfirmation() {
    const request = confirmationRequest
    setConfirmationRequest(null)
    request?.onCancel?.()
  }

  function confirmPendingAction() {
    const request = confirmationRequest
    setConfirmationRequest(null)
    request?.onConfirm()
  }

  function fitCanvasAfterReplace() {
    window.requestAnimationFrame(() => {
      void fitView({ duration: 360, padding: 0.22 })
    })
  }

  function applyCanvasState(nextState: PersistedCanvasState, message: string) {
    requestCanvasOverwrite(
      '匯入',
      () => {
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
      },
      () => setImportMessage('已取消匯入。'),
    )
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
    requestCanvasOverwrite('清空', () => {
      setNodes([])
      setEdges([])
      setSelectedNodeId('')
      setCurrentWorkflowName('')
      setSelectedImportWorkflow('')
      setPreviewActionMessage('已清空畫布。')
    })
  }

  function restoreInitialCanvas() {
    requestCanvasOverwrite('還原初始畫布', () => {
      setNodes(initialNodes)
      setEdges(initialEdges)
      setSelectedNodeId(initialNodes[0]?.id ?? '')
      setCurrentWorkflowName('')
      setSelectedImportWorkflow('')
      setPreviewMode('aiMc')
      setPreviewActionMessage('已還原初始畫布。')
      fitCanvasAfterReplace()
    })
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
    const template = nodeTemplateMetadata.find((item) => item.kind === kind) ?? nodeTemplateMetadata[1]
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
      requestCanvasOverwrite(
        '匯入',
        () => {
          setNodes(imported.nodes)
          setEdges(imported.edges)
          setSelectedNodeId(imported.nodes[0]?.id ?? '')
          setPreviewMode('aiMc')
          setImportWorkflowNames(nextWorkflowNames)
          setCurrentWorkflowName(imported.workflowName)
          setSelectedImportWorkflow(imported.workflowName)
          setImportMessage(`已匯入 ${localizeWorkflowTerm(imported.workflowName)}：${imported.stepCount} 個步驟`)
          fitCanvasAfterReplace()
        },
        () => setImportMessage('已取消匯入。'),
      )
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

  function loadSampleImport() {
    setImportText(sampleImport)
    const names = workflowNamesFromText(sampleImport)
    setImportWorkflowNames(names)
    setSelectedImportWorkflow(names[0] ?? '')
    setImportMessage('')
  }

  function updateImportText(nextValue: string) {
    setImportText(nextValue)
    const names = workflowNamesFromText(nextValue)
    setImportWorkflowNames(names)
    setSelectedImportWorkflow((current) => (
      current && names.includes(current) ? current : names[0] ?? ''
    ))
    setImportMessage('')
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
      <ToolboxPanel
        fileInputRef={fileInputRef}
        importMessage={importMessage}
        importText={importText}
        importWorkflowNames={importWorkflowNames}
        selectedImportWorkflow={selectedImportWorkflow}
        showImportPanel={showImportPanel}
        themeMode={themeMode}
        onAddNode={addNode}
        onImportAiMcWorkflow={importAiMcWorkflow}
        onImportCanvasBackup={importCanvasBackup}
        onImportFileChange={(event) => void loadImportFile(event)}
        onImportTextChange={updateImportText}
        onSelectImportWorkflow={(nextWorkflow) => applyImportedWorkflow(importText, nextWorkflow)}
        onToggleImportPanel={() => setShowImportPanel((current) => !current)}
        onToggleTheme={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
        onUseSampleImport={loadSampleImport}
      />

      <CanvasPanel
        edges={edges}
        nodes={nodes}
        themeMode={themeMode}
        onClearCanvas={clearCanvas}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onFitView={() => void fitView({ duration: 320, padding: 0.22 })}
        onNodesChange={onNodesChange}
        onNodeSelect={setSelectedNodeId}
        onPaneClick={() => setSelectedNodeId('')}
        onReconnect={onReconnect}
        onRestoreInitialCanvas={restoreInitialCanvas}
      />

      <SettingsPanel
        selectedNode={selectedNode}
        onUpdateSelectedNode={updateSelectedNode}
      />

      <PreviewPanel
        activePreview={activePreview}
        edgeCount={edges.length}
        nodeCount={nodes.length}
        previewActionMessage={previewActionMessage}
        previewMode={previewMode}
        showJsonPreview={showJsonPreview}
        onCopyActivePreview={() => void copyActivePreview()}
        onDownloadPreview={downloadPreview}
        onPreviewModeChange={setPreviewMode}
        onToggleJsonPreview={() => setShowJsonPreview((current) => !current)}
      />

      {confirmationRequest && (
        <ConfirmationDialog
          action={confirmationRequest.action}
          onCancel={cancelConfirmation}
          onConfirm={confirmPendingAction}
        />
      )}
    </main>
  )
}
