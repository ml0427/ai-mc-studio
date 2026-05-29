import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  FolderKanban,
  GitBranch,
  History,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Workflow,
} from 'lucide-react'
import YAML from 'yaml'
import './App.css'

type WorkflowStep = {
  id: string
  type: string
  when?: string
  output?: string
  output_schema?: unknown
  command_ref?: string
  commands?: string[]
  delegate?: string
  task_class?: string
  blocks_downstream?: boolean
}

type WorkflowDefinition = {
  description?: string
  steps?: WorkflowStep[]
  gates?: unknown
  evidence?: unknown
}

type WorkflowSpec = {
  schema_version?: string
  name?: string
  description?: string
  workflows?: Record<string, WorkflowDefinition>
}

type WorkflowSummary = {
  name: string
  description: string
  stepCount: number
  requiredInputs: string[]
  optionalInputs: string[]
  gateCount: number
}

type ProjectSummary = {
  id: string
  name: string
  rootPath: string
  workflowPath: string
  workflowCount: number
  stepCount: number
  runCount: number
  latestRun?: WizardRunSummary
  workflows: WorkflowSummary[]
  scannedAt: string
}

type ProjectDetail = ProjectSummary & {
  spec: WorkflowSpec
  rawYaml: string
  rawHash: string
}

type ToastState = {
  tone: 'ok' | 'error' | 'info'
  message: string
}

type WizardRunSummary = {
  runId: string
  workflow: string
  status: string
  currentStep: string | null
  completedCount: number
  skippedCount: number
  totalSteps: number
  updatedAt: string
  statePath: string
}

function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsRoot, setProjectsRoot] = useState('')
  const [scanDepth, setScanDepth] = useState(0)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState('')
  const [selectedStepId, setSelectedStepId] = useState('')
  const [graphSource, setGraphSource] = useState('')
  const [editorValue, setEditorValue] = useState('')
  const [runs, setRuns] = useState<WizardRunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [runGraphSource, setRunGraphSource] = useState('')
  const [runInputValues, setRunInputValues] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<ToastState | null>(null)
  const [loading, setLoading] = useState(false)

  const editorSpec = useMemo(() => parseWorkflowSpec(editorValue, project?.spec), [editorValue, project])
  const workflow = selectedWorkflow
    ? editorSpec.spec?.workflows?.[selectedWorkflow]
    : null
  const steps = useMemo(() => workflow?.steps ?? [], [workflow])
  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? steps[0]
  const selectedWorkflowSummary = project?.workflows.find((item) => item.name === selectedWorkflow)
  const selectedRun = runs.find((run) => run.runId === selectedRunId)
  const isDirty = Boolean(project && editorValue !== project.rawYaml)
  const displayedWorkflowGraph = isDirty && workflow && selectedWorkflow
    ? buildClientMermaid(selectedWorkflow, workflow)
    : graphSource

  const loadRunGraph = useCallback(async (projectId: string, runId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/runs/${encodeURIComponent(runId)}/graph`)
      if (!response.ok) throw new Error(await response.text())
      setRunGraphSource(await response.text())
    } catch (error) {
      setRunGraphSource('')
      setToast({ tone: 'error', message: errorMessage(error) })
    }
  }, [])

  const loadRuns = useCallback(async (
    projectId: string,
    preferredRunId = '',
    options: { quiet?: boolean } = {},
  ) => {
    try {
      const data = await api<{ runs: WizardRunSummary[] }>(`/api/projects/${projectId}/runs`)
      const wanted = preferredRunId
      const nextRunId = data.runs.some((run) => run.runId === wanted)
        ? wanted
        : data.runs[0]?.runId || ''
      setRuns(data.runs)
      if (data.runs.length === 0) setRunGraphSource('')
      setSelectedRunId(nextRunId)
      if (nextRunId) await loadRunGraph(projectId, nextRunId)
    } catch (error) {
      setRuns([])
      setSelectedRunId('')
      setRunGraphSource('')
      if (!options.quiet) setToast({ tone: 'error', message: errorMessage(error) })
    }
  }, [loadRunGraph])

  useEffect(() => {
    void loadProjects()
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    let cancelled = false

    async function readSelectedProject() {
      setLoading(true)
      try {
        const detail = await api<ProjectDetail>(`/api/projects/${selectedProjectId}`)
        if (cancelled) return
        setProject(detail)
        selectWorkflow(detail, detail.workflows[0]?.name ?? '')
        setEditorValue(detail.rawYaml)
        await loadRuns(detail.id)
      } catch (error) {
        if (!cancelled) setToast({ tone: 'error', message: errorMessage(error) })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void readSelectedProject()

    return () => {
      cancelled = true
    }
  }, [loadRuns, selectedProjectId])

  useEffect(() => {
    if (!project || !selectedWorkflow) return
    void loadGraph(project.id, selectedWorkflow)
  }, [project, selectedWorkflow])

  useEffect(() => {
    if (!project) return
    const intervalId = window.setInterval(() => {
      void loadRuns(project.id, selectedRunId, { quiet: true })
    }, 5000)
    return () => window.clearInterval(intervalId)
  }, [loadRuns, project, selectedRunId])

  useEffect(() => {
    function confirmLeave(event: BeforeUnloadEvent) {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', confirmLeave)
    return () => window.removeEventListener('beforeunload', confirmLeave)
  }, [isDirty])

  async function loadProjects() {
    setLoading(true)
    try {
      const data = await api<{ projectsRoot: string; scanDepth: number; projects: ProjectSummary[] }>('/api/projects')
      setProjectsRoot(data.projectsRoot)
      setScanDepth(data.scanDepth)
      setProjects(data.projects)
      setSelectedProjectId((current) => current || data.projects[0]?.id || '')
      setToast({ tone: 'ok', message: `掃描到 ${data.projects.length} 個已接入專案` })
    } catch (error) {
      setToast({ tone: 'error', message: errorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  async function loadGraph(projectId: string, workflowName: string) {
    try {
      const response = await fetch(`/api/projects/${projectId}/workflows/${encodeURIComponent(workflowName)}/graph`)
      if (!response.ok) throw new Error(await response.text())
      setGraphSource(await response.text())
    } catch (error) {
      setGraphSource('')
      setToast({ tone: 'error', message: errorMessage(error) })
    }
  }

  async function startRun() {
    if (!project || !selectedWorkflowSummary) return
    const inputs: Record<string, string> = {}
    const missingInputs = selectedWorkflowSummary.requiredInputs.filter(
      (inputName) => !runInputValues[inputName]?.trim(),
    )

    if (missingInputs.length > 0) {
      setToast({ tone: 'error', message: `缺少必要輸入：${missingInputs.join(', ')}` })
      return
    }

    for (const inputName of [
      ...selectedWorkflowSummary.requiredInputs,
      ...selectedWorkflowSummary.optionalInputs,
    ]) {
      const value = runInputValues[inputName]?.trim()
      if (value) inputs[inputName] = value
    }

    try {
      const result = await api<{ ok: boolean; runId?: string; runs: WizardRunSummary[] }>(
        `/api/projects/${project.id}/runs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ workflow: selectedWorkflow, inputs }),
        },
      )
      setRuns(result.runs)
      setSelectedRunId(result.runId ?? result.runs[0]?.runId ?? '')
      setToast({ tone: 'ok', message: `已建立 run：${result.runId ?? selectedWorkflow}` })
      await loadRuns(project.id, result.runId)
    } catch (error) {
      setToast({ tone: 'error', message: errorMessage(error) })
    }
  }

  async function validateProject() {
    if (!project) return
    try {
      const result = isDirty
        ? await api<{ ok: boolean; output: string }>(`/api/projects/${project.id}/workflow/validate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: editorValue }),
        })
        : await api<{ ok: boolean; output: string }>(`/api/projects/${project.id}/validate`, {
          method: 'POST',
        })
      setToast({ tone: 'ok', message: `${isDirty ? '草稿' : '檔案'}驗證通過：${result.output.trim()}` })
    } catch (error) {
      setToast({ tone: 'error', message: errorMessage(error) })
    }
  }

  async function saveWorkflow() {
    if (!project) return
    if (!isDirty) {
      setToast({ tone: 'info', message: 'workflow.yaml 沒有變更' })
      return
    }
    if (!window.confirm(`確定要儲存 ${project.name} 的 workflow.yaml？會先建立備份。`)) return

    try {
      const result = await api<{ ok: boolean; backupPath: string; project: ProjectDetail }>(
        `/api/projects/${project.id}/workflow`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: editorValue, expectedHash: project.rawHash }),
        },
      )
      setProject(result.project)
      setEditorValue(result.project.rawYaml)
      selectWorkflow(result.project, selectedWorkflow)
      setToast({ tone: 'ok', message: `已儲存，備份在 ${result.backupPath}` })
      await loadProjects()
      await loadRuns(result.project.id, selectedRunId)
    } catch (error) {
      setToast({ tone: 'error', message: errorMessage(error) })
    }
  }

  function selectWorkflow(targetProject: ProjectDetail, workflowName: string) {
    const nextWorkflow = targetProject.spec.workflows?.[workflowName]
      ? workflowName
      : targetProject.workflows[0]?.name ?? ''
    const nextSummary = targetProject.workflows.find((item) => item.name === nextWorkflow)
    setSelectedWorkflow(nextWorkflow)
    setSelectedStepId(targetProject.spec.workflows?.[nextWorkflow]?.steps?.[0]?.id ?? '')
    setRunInputValues(seedRunInputs(nextSummary))
  }

  function selectProject(projectId: string) {
    if (projectId === selectedProjectId) return
    if (isDirty && !window.confirm('目前 workflow.yaml 尚未儲存，確定要切換專案？')) return
    setSelectedProjectId(projectId)
  }

  function updateRunInput(inputName: string, value: string) {
    setRunInputValues((current) => ({
      ...current,
      [inputName]: value,
    }))
  }

  function selectRun(runId: string) {
    setSelectedRunId(runId)
    if (project) void loadRunGraph(project.id, runId)
  }

  function updateSelectedStep(field: 'type' | 'when' | 'output', value: string) {
    const parsed = parseWorkflowSpec(editorValue, null)
    if (!parsed.spec || !selectedWorkflow || !selectedStep?.id) {
      setToast({ tone: 'error', message: parsed.error ?? 'workflow.yaml 目前無法解析' })
      return
    }

    const step = parsed.spec.workflows?.[selectedWorkflow]?.steps?.find((item) => item.id === selectedStep.id)
    if (!step) return

    if (value.trim()) {
      step[field] = value
    } else if (field !== 'type') {
      delete step[field]
    }

    setEditorValue(YAML.stringify(parsed.spec))
  }

  return (
    <main className="studio-shell">
      <aside className="project-rail">
        <div className="brand-mark">
          <div className="brand-icon"><Workflow size={22} /></div>
          <div>
            <span>AI-MC</span>
            <strong>Studio</strong>
          </div>
        </div>

        <button className="rail-action" type="button" onClick={loadProjects}>
          <RefreshCw size={16} />
          重新掃描
        </button>

        <div className="rail-caption">掃描根目錄 · depth {scanDepth}</div>
        <div className="path-chip" title={projectsRoot}>{projectsRoot || '尚未載入'}</div>

        <section className="project-list" aria-label="Projects">
          {projects.map((item) => (
            <button
              className={`project-row ${item.id === selectedProjectId ? 'active' : ''}`}
              key={item.id}
              type="button"
              onClick={() => selectProject(item.id)}
            >
              <FolderKanban size={17} />
              <span>
                <strong>{item.name}</strong>
                <small>{item.workflowCount} workflows · {item.stepCount} steps · {item.runCount} runs</small>
              </span>
            </button>
          ))}
        </section>
      </aside>

      <section className="workbench">
        <header className="workbench-header">
          <div>
            <p className="eyebrow">Project Workflow Console</p>
            <h1>{project?.name ?? '選擇一個專案'}</h1>
            <div className="subtle-path">{project?.rootPath ?? '正在等待掃描結果'}</div>
            {project && (
              <div className="project-metrics">
                <span>{project.workflowCount} workflows</span>
                <span>{project.stepCount} steps</span>
                <span>{project.runCount} runs</span>
                <span>{project.latestRun?.status ?? 'no runs'}</span>
              </div>
            )}
          </div>
          <div className="header-actions">
            <button type="button" onClick={validateProject} disabled={!project}>
              <CheckCircle2 size={16} />
              {isDirty ? '驗證草稿' : '驗證'}
            </button>
            <button type="button" onClick={startRun} disabled={!project || !selectedWorkflow}>
              <Play size={16} />
              建立 Run
            </button>
            <button type="button" className="primary" onClick={saveWorkflow} disabled={!project || !isDirty}>
              <Save size={16} />
              儲存 YAML{isDirty ? ' *' : ''}
            </button>
          </div>
        </header>

        {toast && (
          <div className={`toast ${toast.tone}`}>
            {toast.tone === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.message}</span>
          </div>
        )}

        <div className="studio-grid">
          <nav className="workflow-panel" aria-label="Workflows">
            <div className="panel-title">
              <GitBranch size={16} />
              Workflows
            </div>
            {project?.workflows.map((item) => (
              <button
                className={`workflow-row ${item.name === selectedWorkflow ? 'active' : ''}`}
                key={item.name}
                type="button"
                onClick={() => project && selectWorkflow(project, item.name)}
              >
                <strong>{item.name}</strong>
                <span>{item.stepCount} steps · {item.gateCount} gates</span>
              </button>
            ))}
          </nav>

          <section className="graph-panel">
            <div className="panel-title">
              <Workflow size={16} />
              Workflow Map
              {isDirty && <span className="title-note dirty">preview</span>}
            </div>
            {displayedWorkflowGraph ? <MermaidChart chart={displayedWorkflowGraph} /> : <EmptyState loading={loading} />}
          </section>

          <aside className="inspector-panel">
            <div className="panel-title">
              <FileCode2 size={16} />
              Step Inspector
            </div>
            <div className="step-stack">
              {steps.map((step) => (
                <button
                  className={`step-row ${step.id === selectedStep?.id ? 'active' : ''}`}
                  key={step.id}
                  type="button"
                  onClick={() => setSelectedStepId(step.id)}
                >
                  <span>{step.id}</span>
                  <small>{step.type}</small>
                </button>
              ))}
            </div>
            {selectedStep && (
              <div className="step-facts">
                <span>{selectedStep.type}</span>
                {selectedStep.when && <span>when</span>}
                {selectedStep.command_ref && <span>{selectedStep.command_ref}</span>}
                {selectedStep.output && <span>out: {selectedStep.output}</span>}
                {selectedStep.blocks_downstream && <span>blocks</span>}
              </div>
            )}
            {selectedStep && (
              <div className="step-editor">
                <label>
                  <span>type</span>
                  <select
                    value={selectedStep.type}
                    onChange={(event) => updateSelectedStep('type', event.target.value)}
                  >
                    <option value="ai">ai</option>
                    <option value="shell">shell</option>
                    <option value="tool-or-shell">tool-or-shell</option>
                    <option value="tool-or-code-edit">tool-or-code-edit</option>
                    <option value="file">file</option>
                    <option value="code-edit">code-edit</option>
                  </select>
                </label>
                <label>
                  <span>when</span>
                  <input
                    value={selectedStep.when ?? ''}
                    onChange={(event) => updateSelectedStep('when', event.target.value)}
                    placeholder="always"
                  />
                </label>
                <label>
                  <span>output</span>
                  <input
                    value={selectedStep.output ?? ''}
                    onChange={(event) => updateSelectedStep('output', event.target.value)}
                    placeholder={selectedStep.id}
                  />
                </label>
              </div>
            )}
            <pre className="yaml-view">
              {editorSpec.error ? editorSpec.error : selectedStep ? YAML.stringify(selectedStep) : '尚未選擇 step'}
            </pre>
          </aside>
        </div>

        <section className="editor-panel">
          <div className="panel-title">
            <FileCode2 size={16} />
            workflow.yaml
            {isDirty && <span className="title-note dirty">unsaved</span>}
            <button className="icon-action" type="button" onClick={() => project && setEditorValue(project.rawYaml)} disabled={!isDirty}>
              <RotateCcw size={14} />
              還原
            </button>
          </div>
          <textarea
            spellCheck={false}
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
          />
        </section>

        <section className="run-panel">
          <div className="run-list">
            <div className="panel-title">
              <History size={16} />
              Wizard Runs
              <button
                className="icon-action"
                type="button"
                onClick={() => project && loadRuns(project.id, selectedRunId)}
                disabled={!project}
              >
                <RefreshCw size={14} />
                刷新
              </button>
            </div>
            {selectedWorkflowSummary && (
              <div className="run-inputs">
                <div className="run-input-title">{selectedWorkflow} inputs</div>
                {[
                  ...selectedWorkflowSummary.requiredInputs.map((name) => ({ name, required: true })),
                  ...selectedWorkflowSummary.optionalInputs.map((name) => ({ name, required: false })),
                ].map((input) => (
                  <label key={input.name}>
                    <span>{input.name}{input.required ? ' *' : ''}</span>
                    <input
                      value={runInputValues[input.name] ?? ''}
                      onChange={(event) => updateRunInput(input.name, event.target.value)}
                      placeholder={input.required ? 'required' : 'optional'}
                    />
                  </label>
                ))}
                {selectedWorkflowSummary.requiredInputs.length + selectedWorkflowSummary.optionalInputs.length === 0 && (
                  <div className="mini-empty">這個 workflow 沒有 inputs，可以直接建立 Run。</div>
                )}
              </div>
            )}
            {runs.length === 0 ? (
              <div className="mini-empty">目前沒有 run，按「建立 Run」開始。</div>
            ) : runs.map((run) => (
              <button
                className={`run-row ${run.runId === selectedRunId ? 'active' : ''}`}
                key={run.runId}
                type="button"
                onClick={() => selectRun(run.runId)}
              >
                <strong>{run.workflow}</strong>
                <span>{run.currentStep ?? run.status}</span>
                <small>{run.completedCount + run.skippedCount}/{run.totalSteps} · {formatDate(run.updatedAt)}</small>
              </button>
            ))}
          </div>
          <div className="run-graph">
            <div className="panel-title">
              <Workflow size={16} />
              Run Status
              {selectedRun && <span className="title-note">{selectedRun.runId}</span>}
            </div>
            {runGraphSource ? <MermaidChart chart={runGraphSource} /> : <EmptyState loading={loading} />}
          </div>
        </section>
      </section>
    </main>
  )
}

function MermaidChart({ chart }: { chart: string }) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-${crypto.randomUUID()}`

    async function renderChart() {
      const { default: mermaid } = await import('mermaid')
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: {
          fontFamily: 'Aptos, Segoe UI, sans-serif',
        },
      })
      const { svg } = await mermaid.render(id, chart)
      if (!cancelled && elementRef.current) {
        elementRef.current.innerHTML = svg
        setError('')
      }
    }

    renderChart()
      .then(() => {
        // Rendering side effects are handled in renderChart.
      })
      .catch((reason) => {
        if (!cancelled && elementRef.current) {
          elementRef.current.innerHTML = ''
        }
        if (!cancelled) setError(errorMessage(reason))
      })

    return () => {
      cancelled = true
    }
  }, [chart])

  if (error) {
    return <pre className="yaml-view error-text">{error}</pre>
  }

  return <div className="mermaid-stage" ref={elementRef} />
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="empty-state">
      <Workflow size={28} />
      <strong>{loading ? '讀取中' : '沒有可顯示的 workflow'}</strong>
      <span>掃描專案後會在這裡顯示流程圖。</span>
    </div>
  )
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(payload?.message ?? text ?? response.statusText)
  }
  return payload as T
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatDate(value: string): string {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function seedRunInputs(summary?: WorkflowSummary): Record<string, string> {
  const next: Record<string, string> = {}
  if (!summary) return next

  for (const inputName of [
    ...summary.requiredInputs,
    ...summary.optionalInputs,
  ]) {
    next[inputName] = ''
  }

  return next
}

function parseWorkflowSpec(value: string, fallback?: WorkflowSpec | null): { spec: WorkflowSpec | null; error: string } {
  if (!value.trim()) return { spec: fallback ?? null, error: '' }
  try {
    return { spec: YAML.parse(value) as WorkflowSpec, error: '' }
  } catch (error) {
    return { spec: fallback ?? null, error: errorMessage(error) }
  }
}

function buildClientMermaid(workflowName: string, workflow: WorkflowDefinition): string {
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

export default App
