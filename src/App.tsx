import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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
import {
  addBranchHandle,
  deleteCanvasSelection,
  duplicateNode,
  layoutWorkflowCanvas,
  removeBranchHandle,
  renameBranchHandle,
} from './workflow/canvasEditing'
import { edgeLabel, edgeOptionsForConnection } from './workflow/edges'
import { sampleImport } from './workflow/examples'
import { localizeWorkflowTerm } from './workflow/localization'
import { parseAiMcWorkflow, workflowNamesFromText } from './workflow/parse'
import { createCanvasBackup, parseCanvasBackup, readCanvasStateFromStorage, writeCanvasStateToStorage } from './workflow/persistence'
import { defaultConditionBranchHandles, initialEdges, initialNodes, nodeTemplateMetadata } from './workflow/templates'
import type { PersistedCanvasState } from './workflow/persistence'
import type { EditableField, PreviewMode, ThemeMode, WorkflowEdge, WorkflowNode, WorkflowNodeKind } from './workflow/types'

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

type CanvasSnapshot = {
  edges: WorkflowEdge[]
  nodes: WorkflowNode[]
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
  const [selectedEdgeId, setSelectedEdgeId] = useState('')
  const [pastCanvasStates, setPastCanvasStates] = useState<CanvasSnapshot[]>([])
  const [futureCanvasStates, setFutureCanvasStates] = useState<CanvasSnapshot[]>([])
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
  const canUndo = pastCanvasStates.length > 0
  const canRedo = futureCanvasStates.length > 0
  const hasSelectedElement = Boolean(selectedNodeId || selectedEdgeId)

  function currentCanvasSnapshot(): CanvasSnapshot {
    return { nodes, edges }
  }

  function applyCanvasMutation(nextNodes: WorkflowNode[], nextEdges: WorkflowEdge[], options: { selectEdgeId?: string; selectNodeId?: string } = {}) {
    setPastCanvasStates((current) => [...current, currentCanvasSnapshot()].slice(-40))
    setFutureCanvasStates([])
    setNodes(nextNodes)
    setEdges(nextEdges)
    setSelectedNodeId(options.selectNodeId ?? '')
    setSelectedEdgeId(options.selectEdgeId ?? '')
  }

  const canvasPreview = useMemo(() => createCanvasBackup({
    nodes,
    edges,
    selectedWorkflowName: currentWorkflowName,
    previewMode,
    themeMode,
  }), [currentWorkflowName, edges, nodes, previewMode, themeMode])
  const aiMcPreview = useMemo(() => JSON.stringify(toAiMcWorkflowSpec(nodes, edges), null, 2), [edges, nodes])
  const graphPreview = useMemo(() => YAML.stringify(toGraphWorkflowSpec(nodes, edges)), [edges, nodes])
  function previewByMode(mode: PreviewMode) {
    switch (mode) {
      case 'aiMc':
        return aiMcPreview
      case 'graph':
        return graphPreview
      case 'canvas':
        return canvasPreview
    }
  }
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

  function undoCanvasChange() {
    setPastCanvasStates((past) => {
      const previous = past.at(-1)
      if (!previous) return past
      setFutureCanvasStates((future) => [currentCanvasSnapshot(), ...future].slice(0, 40))
      setNodes(previous.nodes)
      setEdges(previous.edges)
      setSelectedNodeId(previous.nodes[0]?.id ?? '')
      setSelectedEdgeId('')
      return past.slice(0, -1)
    })
  }

  function redoCanvasChange() {
    setFutureCanvasStates((future) => {
      const next = future[0]
      if (!next) return future
      setPastCanvasStates((past) => [...past, currentCanvasSnapshot()].slice(-40))
      setNodes(next.nodes)
      setEdges(next.edges)
      setSelectedNodeId(next.nodes[0]?.id ?? '')
      setSelectedEdgeId('')
      return future.slice(1)
    })
  }

  function deleteSelectedElement() {
    const result = deleteCanvasSelection(nodes, edges, { nodeId: selectedNodeId, edgeId: selectedEdgeId })
    applyCanvasMutation(result.nodes, result.edges)
    setPreviewActionMessage('已刪除選取項目。')
  }

  function duplicateSelectedNode() {
    if (!selectedNodeId) return
    const result = duplicateNode(nodes, selectedNodeId)
    if (!result) return
    applyCanvasMutation(result.nodes, edges, { selectNodeId: result.node.id })
    setPreviewActionMessage('已複製選取節點。')
  }

  function autoLayoutCanvas() {
    const nextNodes = layoutWorkflowCanvas(nodes, edges)
    applyCanvasMutation(nextNodes, edges, { selectNodeId: selectedNodeId })
    setPreviewActionMessage('已自動整理節點位置。')
    fitCanvasAfterReplace()
  }

  function applyCanvasState(nextState: PersistedCanvasState, message: string) {
    requestCanvasOverwrite(
      '匯入',
      () => {
        applyCanvasMutation(nextState.nodes, nextState.edges, { selectNodeId: nextState.nodes[0]?.id ?? '' })
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
      applyCanvasMutation([], [])
      setCurrentWorkflowName('')
      setSelectedImportWorkflow('')
      setPreviewActionMessage('已清空畫布。')
    })
  }

  function restoreInitialCanvas() {
    requestCanvasOverwrite('還原初始畫布', () => {
      applyCanvasMutation(initialNodes, initialEdges, { selectNodeId: initialNodes[0]?.id ?? '' })
      setCurrentWorkflowName('')
      setSelectedImportWorkflow('')
      setPreviewMode('aiMc')
      setPreviewActionMessage('已還原初始畫布。')
      fitCanvasAfterReplace()
    })
  }

  function onConnect(connection: Connection) {
    const sourceNode = nodes.find((node) => node.id === connection.source)
    const nextEdge = {
      ...connection,
      ...edgeOptionsForConnection(
        sourceNode?.data.kind,
        connection.sourceHandle,
        undefined,
        sourceNode?.data.branchHandles,
      ),
      id: `${connection.source}:${connection.sourceHandle}->${connection.target}:${connection.targetHandle}`,
    }
    applyCanvasMutation(nodes, addEdge(nextEdge, edges), { selectEdgeId: nextEdge.id })
  }

  const onReconnect: OnReconnect<WorkflowEdge> = (oldEdge, newConnection) => {
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
    applyCanvasMutation(nodes, reconnectEdge(oldEdge, nextEdge, edges), { selectEdgeId: nextEdge.id })
  }

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
        branchHandles: kind === 'condition' ? defaultConditionBranchHandles.map((handle) => ({ ...handle })) : undefined,
      },
    }

    applyCanvasMutation([...nodes, nextNode], edges, { selectNodeId: id })
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
          applyCanvasMutation(imported.nodes, imported.edges, { selectNodeId: imported.nodes[0]?.id ?? '' })
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
    const nextNodes = nodes.map((node) => (
      node.id === selectedNode.id
        ? { ...node, data: { ...node.data, [field]: value } }
        : node
    ))
    applyCanvasMutation(nextNodes, edges, { selectNodeId: selectedNode.id })
  }

  function addSelectedNodeBranch() {
    if (!selectedNode) return
    const result = addBranchHandle(nodes, selectedNode.id)
    applyCanvasMutation(result.nodes, edges, { selectNodeId: selectedNode.id })
  }

  function renameSelectedNodeBranch(handleId: string, label: string) {
    if (!selectedNode) return
    const result = renameBranchHandle(nodes, edges, selectedNode.id, handleId, label)
    applyCanvasMutation(result.nodes, result.edges, { selectNodeId: selectedNode.id })
  }

  function removeSelectedNodeBranch(handleId: string) {
    if (!selectedNode) return
    const result = removeBranchHandle(nodes, edges, selectedNode.id, handleId)
    applyCanvasMutation(result.nodes, result.edges, { selectNodeId: selectedNode.id })
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTextInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if (isTextInput) return

      if ((event.key === 'Delete' || event.key === 'Backspace') && hasSelectedElement) {
        event.preventDefault()
        deleteSelectedElement()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedNodeId) {
        event.preventDefault()
        duplicateSelectedNode()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redoCanvasChange()
        else undoCanvasChange()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redoCanvasChange()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

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
        canDuplicate={Boolean(selectedNodeId)}
        canRedo={canRedo}
        canUndo={canUndo}
        canDelete={hasSelectedElement}
        edges={edges}
        nodes={nodes}
        selectedEdgeId={selectedEdgeId}
        selectedNodeId={selectedNodeId}
        themeMode={themeMode}
        onAutoLayout={autoLayoutCanvas}
        onClearCanvas={clearCanvas}
        onConnect={onConnect}
        onDeleteSelected={deleteSelectedElement}
        onDuplicateSelected={duplicateSelectedNode}
        onEdgesChange={onEdgesChange}
        onFitView={() => void fitView({ duration: 320, padding: 0.22 })}
        onNodesChange={onNodesChange}
        onNodeSelect={(nodeId) => {
          setSelectedNodeId(nodeId)
          setSelectedEdgeId('')
        }}
        onEdgeSelect={(edgeId) => {
          setSelectedEdgeId(edgeId)
          setSelectedNodeId('')
        }}
        onPaneClick={() => {
          setSelectedNodeId('')
          setSelectedEdgeId('')
        }}
        onReconnect={onReconnect}
        onRedo={redoCanvasChange}
        onRestoreInitialCanvas={restoreInitialCanvas}
        onUndo={undoCanvasChange}
      />

      <SettingsPanel
        selectedNode={selectedNode}
        onAddBranch={addSelectedNodeBranch}
        onRemoveBranch={removeSelectedNodeBranch}
        onRenameBranch={renameSelectedNodeBranch}
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
