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
  Moon,
  PanelRight,
  Plus,
  Route,
  Square,
  Sun,
} from 'lucide-react'
import YAML from 'yaml'

type WorkflowNodeKind =
  | 'start'
  | 'ai_task'
  | 'condition'
  | 'human_check'
  | 'output'
  | 'shell'
  | 'tool'
  | 'file'
  | 'code_edit'
  | 'terminal'

type WorkflowNodeData = {
  kind: WorkflowNodeKind
  title: string
  description: string
  purpose: string
  instructions: string
  decisionRules: string
  input: string
  output: string
  branchHandles?: BranchHandle[]
}

type BranchHandle = {
  id: string
  label: string
}

type WorkflowNode = Node<WorkflowNodeData, 'workflowNode'>
type WorkflowEdge = Edge
type EditableField = keyof Pick<
  WorkflowNodeData,
  'title' | 'description' | 'purpose' | 'instructions' | 'decisionRules' | 'input' | 'output'
>
type PreviewMode = 'aiMc' | 'graph' | 'canvas'
type ThemeMode = 'dark' | 'light'

type AiMcWorkflowStep = {
  id: string
  type: string
  label?: string
  title?: string
  description?: string
  purpose?: string
  instructions?: string | string[]
  decision_rules?: string | string[]
  when?: string
  input?: string | string[]
  output?: string
  blocks_downstream?: boolean
  command_ref?: string
  strategy?: unknown
  output_schema?: {
    required?: string[]
  }
}

type AiMcGraphNode = {
  id: string
  kind?: string
  type?: string
  label?: string
  title?: string
  description?: string
  purpose?: string
  instructions?: string | string[]
  decision_rules?: string | string[]
  input?: string | string[]
  output?: string
  when?: string
  handles?: BranchHandle[]
}

type AiMcGraphEdge = {
  from?: string
  source?: string
  to?: string
  target?: string
  branch?: string
  branch_label?: string
  label?: string
  handle?: string
  sourceHandle?: string
  targetHandle?: string
}

type AiMcWorkflowSpec = {
  schema_version?: string
  name?: string
  description?: string
  workflows?: Record<string, {
    title?: string
    description?: string
    steps?: AiMcWorkflowStep[]
    graph?: {
      direction?: string
      nodes?: AiMcGraphNode[]
      edges?: AiMcGraphEdge[]
    }
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
  shell: 'Shell',
  tool: '工具',
  file: '檔案',
  code_edit: '改程式',
  terminal: '結束',
}

const workflowTermLabels: Record<string, string> = {
  API: '介面',
  Bug: '錯誤',
  DB: '資料庫',
  Git: 'Git',
  git: 'Git',
  GitHub: 'GitHub',
  Issue: '問題單',
  PR: '合併請求',
  UI: '畫面',
  acceptance_checks: '驗收條件',
  acceptance_hint: '驗收提示',
  adjacent_features_checked: '已檢查的相鄰功能',
  'adjacent-regression-review': '檢查相鄰功能是否受影響',
  agent: 'AI',
  api_findings: '介面檢查結果',
  assertion: '斷言',
  'bug-scan': '追查錯誤',
  blocking_findings: '阻塞問題',
  blocking: '阻塞',
  caller: '呼叫者',
  candidate_areas: '可能相關區域',
  candidate_symbols: '可能相關的函式或檔案',
  change_impact: '變更影響',
  change_kinds: '變更類型',
  changed_files: '已修改檔案',
  'clarify-feature': '釐清功能需求',
  'classify-change': '判斷變更類型',
  code_hits: '程式搜尋結果',
  confidence: '信心程度',
  config: '設定',
  contract: '契約',
  consumer: '使用者端',
  data_flow: '資料流',
  diagnose: '診斷問題',
  diff: '差異內容',
  docs: '文件',
  entry_points: '進入點',
  error_hits: '錯誤搜尋結果',
  error_message: '錯誤訊息',
  error: '錯誤',
  empty: '空狀態',
  fallback: '備用做法',
  'feature-dev': '做新功能',
  feature_keywords: '功能關鍵字',
  feature_request: '功能需求',
  findings: '發現',
  'findings-first': '先列問題',
  files_requiring_callers: '需要追呼叫者的檔案',
  files_to_change: '要修改的檔案',
  files_to_read: '要閱讀的檔案',
  focus: '處理重點',
  focused_source: '重點來源',
  git_status: 'Git 狀態',
  'github-issue-fix': '修 GitHub 問題單',
  impact_notes: '影響分析筆記',
  'implementation-plan': '規劃實作',
  initial_hypotheses: '初步假設',
  issue_json: '問題單內容',
  issue_keywords: '搜尋關鍵字',
  issue: '問題單',
  keywords: '關鍵字',
  loading: '載入狀態',
  log: '日誌',
  likely_breakpoints: '可能出問題的位置',
  low_model_subtasks: '可交給低成本模型的小任務',
  memory_notes: '記憶筆記',
  memory: '記憶',
  minimal_fix_plan: '最小修正計畫',
  minimal_patch_plan: '最小修改計畫',
  non_goals: '不處理的範圍',
  open_questions: '待釐清問題',
  patch: '修改',
  patch_summary: '修改摘要',
  plain_language_goal: '白話目標',
  plain_language_meaning: '白話說明',
  preferred: '優先做法',
  probe: '探查',
  probe_needed: '需要探查',
  probe_result: '探查結果',
  'pr-review': '審查合併請求',
  raw_diff: '原始差異',
  race: '競態問題',
  risky: '高風險',
  risk_areas: '風險區域',
  risks: '風險',
  root_cause_candidate: '可能根因',
  search_error: '搜尋錯誤線索',
  search_feature_terms: '搜尋功能關鍵字',
  search_issue_terms: '搜尋問題單關鍵字',
  search_symptom_terms: '搜尋症狀關鍵字',
  status: '狀態',
  state: '狀態',
  suggested_followup_checks: '建議後續檢查',
  shared_util: '共用工具',
  'shared-util': '共用工具',
  summarize_issue: '整理問題單',
  'summarize-issue': '整理問題單',
  suspected_area: '疑似問題區域',
  symptom: '症狀',
  tests: '測試',
  test_findings: '測試發現',
  tests_to_run: '要跑的測試',
  'trace-data-flow': '追資料流',
  'trace-data-flow.files_to_read': '追資料流要看的檔案',
  ui_findings: '畫面檢查結果',
  verification_output: '驗證輸出',
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
      purpose: '定義流程入口，讓後面的步驟有明確起點。',
      instructions: '',
      decisionRules: '',
      input: '',
      output: 'start',
    },
  },
]

const initialEdges: WorkflowEdge[] = []
const nodeTypes = { workflowNode: WorkflowNodeCard }
const defaultConditionBranchHandles: BranchHandle[] = [
  { id: 'yes', label: '是' },
  { id: 'no', label: '否' },
]
const defaultEdgeOptions = {
  animated: true,
  reconnectable: true,
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    color: 'var(--flow-edge)',
  },
  style: {
    stroke: 'var(--flow-edge)',
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

function nodeColor(kind: WorkflowNodeKind): string {
  if (kind === 'start') return '#89f7fe'
  if (kind === 'ai_task') return '#a78bfa'
  if (kind === 'condition') return '#fbbf24'
  if (kind === 'human_check') return '#34d399'
  if (kind === 'shell') return '#60a5fa'
  if (kind === 'tool') return '#2dd4bf'
  if (kind === 'file') return '#38bdf8'
  if (kind === 'code_edit') return '#fb7185'
  if (kind === 'terminal') return '#f97316'
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

function toGraphWorkflowSpec(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
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

function toGraphNode(node: WorkflowNode) {
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

function toGraphEdge(edge: WorkflowEdge) {
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

function parseAiMcWorkflow(value: string, requestedWorkflowName = ''): {
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

function workflowNamesFromText(value: string): string[] {
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

function formatCompactValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatCompactValue).join('、')
  if (value && typeof value === 'object') return Object.keys(value).map(localizeWorkflowTerm).join('、')
  return localizeWorkflowTerm(String(value))
}

function localizeWorkflowText(value: string) {
  const phraseLocalized = value
    .replace(/\bLead agent\b/g, '主控 AI')
    .replace(/\bAI note\b/g, 'AI 筆記')
    .replace(/\bnpm run build\b/g, '執行 npm run build')
    .replace(/\broot cause\b/g, '根因')
    .replace(/\bcode\b/g, '程式')
    .replace(/\bcommit\b/g, '提交')
    .replace(/\bpush\b/g, '推送')
    .replace(/\bclose issue\b/g, '關閉問題單')
    .replace(/\bconsumer\b/g, '使用者端')
    .replace(/\bcaller\b/g, '呼叫者')
  return phraseLocalized
    .replace(/\bCommand ref\b/g, '指令')
    .replace(/\bOutput\b/g, '輸出')
    .replace(/\bInput\b/g, '輸入')
    .replace(/\bStrategy\b/g, '策略')
    .replace(/\s*\|\s*/g, '；')
    .replace(/[A-Za-z][A-Za-z0-9_.-]*/g, (term) => localizeWorkflowTerm(term))
}

function localizeWorkflowTerm(value: string) {
  return workflowTermLabels[value] ?? workflowTermLabels[value.replace(/-/g, '_')] ?? value
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

function sanitizeHandleId(value: string) {
  return sanitizeStepId(value || 'branch')
}

function canonicalConditionHandleId(value: string | undefined | null) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'yes' || normalized === '是') return 'yes'
  if (normalized === 'no' || normalized === '否') return 'no'
  return sanitizeHandleId(String(value ?? 'branch'))
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

function branchLabelForHandle(sourceHandle?: string | null, branchHandles: BranchHandle[] = []) {
  if (!sourceHandle) return undefined
  const customLabel = branchHandles.find((handle) => handle.id === sourceHandle)?.label
  if (customLabel) return customLabel
  if (sourceHandle === 'yes') return '是'
  if (sourceHandle === 'no') return '否'
  return undefined
}

function localizedBranchLabel(branch: string | undefined) {
  if (!branch) return undefined
  if (branch === 'yes') return '是'
  if (branch === 'no') return '否'
  if (branch === 'pass') return '通過'
  if (branch === 'loop') return '回圈'
  return branch
}

function layoutGraph(graphNodes: AiMcGraphNode[], graphEdges: AiMcGraphEdge[]) {
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

function graphKindFromType(type: string | undefined): WorkflowNodeKind {
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

function makeWorkflowEdge(
  source: string,
  target: string,
  sourceKind?: WorkflowNodeKind,
  options: {
    id?: string
    sourceHandle?: string
    targetHandle?: string
    label?: string
    showLabel?: boolean
    sourceBranchHandles?: BranchHandle[]
  } = {},
): WorkflowEdge {
  const sourceHandle = options.sourceHandle ?? (sourceKind === 'condition' ? 'yes' : 'bottom')
  const targetHandle = options.targetHandle ?? 'top'
  const displayLabel = options.showLabel === false ? undefined : options.label
  return {
    ...edgeOptionsForConnection(sourceKind, sourceHandle, displayLabel, options.sourceBranchHandles),
    id: options.id ?? `${source}:${sourceHandle}->${target}:${targetHandle}`,
    source,
    sourceHandle,
    target,
    targetHandle,
    data: options.label ? { label: options.label } : undefined,
  }
}

function edgeOptionsForConnection(
  sourceKind?: WorkflowNodeKind,
  sourceHandle?: string | null,
  explicitLabel?: string,
  branchHandles: BranchHandle[] = [],
): Partial<WorkflowEdge> {
  const label = explicitLabel ?? (sourceKind === 'condition' ? branchLabelForHandle(sourceHandle, branchHandles) : undefined)
  if (!label) return defaultEdgeOptions
  return {
    ...defaultEdgeOptions,
    label,
    labelStyle: {
      fill: 'var(--flow-label-text)',
      fontSize: 12,
      fontWeight: 900,
    },
    labelBgStyle: {
      fill: 'var(--flow-label-bg)',
      fillOpacity: 1,
    },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 999,
  }
}

function edgeLabel(edge: WorkflowEdge) {
  if (typeof edge.label === 'string') return edge.label
  if (edge.data && typeof edge.data === 'object' && 'label' in edge.data && typeof edge.data.label === 'string') {
    return edge.data.label
  }
  return undefined
}

function aiMcStepType(kind: WorkflowNodeKind): string {
  if (kind === 'human_check') return 'code-edit'
  if (kind === 'code_edit') return 'code-edit'
  if (kind === 'shell') return 'shell'
  if (kind === 'tool') return 'tool-or-shell'
  if (kind === 'file' || kind === 'output' || kind === 'terminal') return 'file'
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

function normalizeTextBlock(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.map((item) => localizeWorkflowText(item)).join('\n')
  return value ? localizeWorkflowText(value) : ''
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function sanitizeStepId(value: string): string {
  const safe = value.trim().replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_')
  return safe || 'step'
}
