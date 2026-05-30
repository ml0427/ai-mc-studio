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
  Search,
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
  inputExamples?: Record<string, string>
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

type ValidationResult = {
  tone: 'ok' | 'error'
  title: string
  output: string
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

type WizardRunState = {
  run_id?: string
  workflow?: string
  status?: string
  current_step?: string | null
  completed_steps?: unknown[]
  skipped_steps?: unknown[]
  steps?: unknown[]
  created_at?: string
  updated_at?: string
  inputs?: Record<string, unknown>
}

function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsRoot, setProjectsRoot] = useState('')
  const [scanDepth, setScanDepth] = useState(0)
  const [projectFilter, setProjectFilter] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState('')
  const [selectedStepId, setSelectedStepId] = useState('')
  const [graphSource, setGraphSource] = useState('')
  const [editorValue, setEditorValue] = useState('')
  const [runs, setRuns] = useState<WizardRunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [runGraphSource, setRunGraphSource] = useState('')
  const [selectedRunState, setSelectedRunState] = useState<WizardRunState | null>(null)
  const [runInputValues, setRunInputValues] = useState<Record<string, string>>({})
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
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
  const hasRunInputExamples = Boolean(
    selectedWorkflowSummary?.inputExamples
    && Object.keys(selectedWorkflowSummary.inputExamples).length > 0,
  )
  const filteredProjects = useMemo(() => {
    const keyword = projectFilter.trim().toLowerCase()
    if (!keyword) return projects

    return projects.filter((item) => [
      item.name,
      item.rootPath,
      ...item.workflows.map((workflowItem) => workflowItem.name),
    ].some((value) => value.toLowerCase().includes(keyword)))
  }, [projectFilter, projects])
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
      setToast({ tone: 'error', message: friendlyErrorMessage(error) })
    }
  }, [])

  const loadRunState = useCallback(async (projectId: string, runId: string) => {
    try {
      setSelectedRunState(await api<WizardRunState>(`/api/projects/${projectId}/runs/${encodeURIComponent(runId)}`))
    } catch (error) {
      setSelectedRunState(null)
      setToast({ tone: 'error', message: friendlyErrorMessage(error) })
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
      if (data.runs.length === 0) {
        setRunGraphSource('')
        setSelectedRunState(null)
      }
      setSelectedRunId(nextRunId)
      if (nextRunId) {
        await Promise.all([
          loadRunGraph(projectId, nextRunId),
          loadRunState(projectId, nextRunId),
        ])
      }
    } catch (error) {
      setRuns([])
      setSelectedRunId('')
      setRunGraphSource('')
      setSelectedRunState(null)
      if (!options.quiet) setToast({ tone: 'error', message: friendlyErrorMessage(error) })
    }
  }, [loadRunGraph, loadRunState])

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
        if (!cancelled) setToast({ tone: 'error', message: friendlyErrorMessage(error) })
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
      setToast({ tone: 'error', message: friendlyErrorMessage(error) })
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
      setToast({ tone: 'error', message: friendlyErrorMessage(error) })
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
      setToast({ tone: 'error', message: friendlyErrorMessage(error) })
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
      setValidationResult({
        tone: 'ok',
        title: `${isDirty ? '草稿' : '檔案'}驗證通過`,
        output: result.output.trim(),
      })
      setToast({ tone: 'ok', message: `${isDirty ? '草稿' : '檔案'}驗證通過` })
    } catch (error) {
      const message = friendlyErrorMessage(error)
      setValidationResult({
        tone: 'error',
        title: `${isDirty ? '草稿' : '檔案'}驗證失敗`,
        output: message,
      })
      setToast({ tone: 'error', message })
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
      setToast({ tone: 'error', message: friendlyErrorMessage(error) })
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

  function fillRunInputExamples() {
    if (!selectedWorkflowSummary?.inputExamples) return
    setRunInputValues((current) => {
      const next = { ...current }
      for (const inputName of [
        ...selectedWorkflowSummary.requiredInputs,
        ...selectedWorkflowSummary.optionalInputs,
      ]) {
        const example = selectedWorkflowSummary.inputExamples?.[inputName]
        if (example && !next[inputName]) next[inputName] = example
      }
      return next
    })
  }

  function selectRun(runId: string) {
    setSelectedRunId(runId)
    if (project) {
      void loadRunGraph(project.id, runId)
      void loadRunState(project.id, runId)
    }
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

        <div className="rail-caption">掃描根目錄 · 層數 {scanDepth}</div>
        <div className="path-chip" title={projectsRoot}>{projectsRoot || '尚未載入'}</div>

        <label className="rail-search">
          <Search size={15} />
          <input
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            placeholder="搜尋專案或流程"
          />
        </label>

        <section className="project-list" aria-label="專案列表">
          {filteredProjects.map((item) => (
            <button
              className={`project-row ${item.id === selectedProjectId ? 'active' : ''}`}
              key={item.id}
              type="button"
              onClick={() => selectProject(item.id)}
            >
              <FolderKanban size={17} />
              <span>
                <strong>{item.name}</strong>
                <small>{countLabel(item.workflowCount, '條流程')} · {countLabel(item.stepCount, '個步驟')} · {countLabel(item.runCount, '次執行')}</small>
              </span>
            </button>
          ))}
          {filteredProjects.length === 0 && (
            <div className="rail-empty">沒有符合的專案</div>
          )}
        </section>
      </aside>

      <section className="workbench">
        <header className="workbench-header">
          <div>
            <p className="eyebrow">AI 司儀中控台</p>
            <h1>{project?.name ?? '選擇一個專案'}</h1>
            <div className="subtle-path">{project?.rootPath ?? '正在等待掃描結果'}</div>
            {project && (
              <div className="project-metrics">
                <span>{countLabel(project.workflowCount, '條流程')}</span>
                <span>{countLabel(project.stepCount, '個步驟')}</span>
                <span>{countLabel(project.runCount, '次執行')}</span>
                <span>{project.latestRun ? statusLabel(project.latestRun.status) : '尚未執行'}</span>
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
              開始執行
            </button>
            <button type="button" className="primary" onClick={saveWorkflow} disabled={!project || !isDirty}>
              <Save size={16} />
              儲存流程{isDirty ? ' *' : ''}
            </button>
          </div>
        </header>

        <StarterGuide
          project={project}
          selectedWorkflow={selectedWorkflow}
          selectedRun={selectedRun}
          requiredInputCount={selectedWorkflowSummary?.requiredInputs.length ?? 0}
        />

        {toast && (
          <div className={`toast ${toast.tone}`}>
            {toast.tone === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.message}</span>
          </div>
        )}

        <div className="studio-grid">
          <nav className="workflow-panel" aria-label="流程列表">
            <div className="panel-title">
              <GitBranch size={16} />
              流程
            </div>
            {project?.workflows.map((item) => (
              <button
                className={`workflow-row ${item.name === selectedWorkflow ? 'active' : ''}`}
                key={item.name}
                type="button"
                onClick={() => project && selectWorkflow(project, item.name)}
              >
                <strong>{item.name}</strong>
                <span>{countLabel(item.stepCount, '個步驟')} · {countLabel(item.gateCount, '個檢查點')}</span>
              </button>
            ))}
          </nav>

          <section className="graph-panel">
            <div className="panel-title">
              <Workflow size={16} />
              流程圖
              {isDirty && <span className="title-note dirty">草稿預覽</span>}
            </div>
            <StepLegend />
            {displayedWorkflowGraph ? <MermaidChart chart={displayedWorkflowGraph} /> : <EmptyState loading={loading} />}
          </section>

          <aside className="inspector-panel">
            <div className="panel-title">
              <FileCode2 size={16} />
              步驟設定
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
                  <small>{stepTypeMeta(step.type).label}</small>
                </button>
              ))}
            </div>
            {selectedStep && (
              <div className="step-facts">
                <span>{stepTypeMeta(selectedStep.type).label}</span>
                {selectedStep.when && <span>條件</span>}
                {selectedStep.command_ref && <span>{selectedStep.command_ref}</span>}
                {selectedStep.output && <span>輸出：{selectedStep.output}</span>}
                {selectedStep.blocks_downstream && <span>會阻擋後續</span>}
              </div>
            )}
            {selectedStep && (
              <div className={`step-editor block-card ${stepTypeMeta(selectedStep.type).className}`}>
                <div className="block-card-header">
                  <span>{stepTypeMeta(selectedStep.type).label}</span>
                  <small>{stepTypeMeta(selectedStep.type).hint}</small>
                </div>
                <label>
                  <span>這一步要做什麼</span>
                  <select
                    value={selectedStep.type}
                    onChange={(event) => updateSelectedStep('type', event.target.value)}
                  >
                    <option value="ai">{stepTypeMeta('ai').label} · ai</option>
                    <option value="shell">{stepTypeMeta('shell').label} · shell</option>
                    <option value="tool-or-shell">{stepTypeMeta('tool-or-shell').label} · tool-or-shell</option>
                    <option value="tool-or-code-edit">{stepTypeMeta('tool-or-code-edit').label} · tool-or-code-edit</option>
                    <option value="file">{stepTypeMeta('file').label} · file</option>
                    <option value="code-edit">{stepTypeMeta('code-edit').label} · code-edit</option>
                  </select>
                </label>
                <label>
                  <span>什麼時候做</span>
                  <input
                    value={selectedStep.when ?? ''}
                    onChange={(event) => updateSelectedStep('when', event.target.value)}
                    placeholder="always"
                  />
                </label>
                <label>
                  <span>完成後叫什麼名字</span>
                  <input
                    value={selectedStep.output ?? ''}
                    onChange={(event) => updateSelectedStep('output', event.target.value)}
                    placeholder={selectedStep.id}
                  />
                </label>
              </div>
            )}
            <pre className="yaml-view">
              {editorSpec.error ? editorSpec.error : selectedStep ? YAML.stringify(selectedStep) : '尚未選擇步驟'}
            </pre>
          </aside>
        </div>

        <section className="editor-panel">
          <div className="panel-title">
            <FileCode2 size={16} />
            進階流程原始檔
            <span className="title-note">workflow.yaml</span>
            {isDirty && <span className="title-note dirty">尚未儲存</span>}
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
          {validationResult && (
            <div className={`validation-result ${validationResult.tone}`}>
              <strong>{validationResult.title}</strong>
              <pre>{validationResult.output || '通過'}</pre>
            </div>
          )}
        </section>

        <section className="run-panel">
          <div className="run-list">
            <div className="panel-title">
              <History size={16} />
              執行紀錄
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
                <div className="run-input-title">
                  <span>{selectedWorkflow} 的輸入欄位</span>
                  {hasRunInputExamples && (
                    <button type="button" onClick={fillRunInputExamples}>套用範例</button>
                  )}
                </div>
                {[
                  ...selectedWorkflowSummary.requiredInputs.map((name) => ({ name, required: true })),
                  ...selectedWorkflowSummary.optionalInputs.map((name) => ({ name, required: false })),
                ].map((input) => (
                  <label key={input.name}>
                    <span>{input.name}{input.required ? ' *' : ''}</span>
                    <input
                      value={runInputValues[input.name] ?? ''}
                      onChange={(event) => updateRunInput(input.name, event.target.value)}
                      placeholder={inputPlaceholder(input.name, input.required, selectedWorkflowSummary)}
                    />
                  </label>
                ))}
                {selectedWorkflowSummary.requiredInputs.length + selectedWorkflowSummary.optionalInputs.length === 0 && (
                  <div className="mini-empty">這條流程沒有輸入欄位，可以直接開始執行。</div>
                )}
              </div>
            )}
            {runs.length === 0 ? (
              <div className="mini-empty">目前沒有執行紀錄，按「開始執行」。</div>
            ) : runs.map((run) => (
              <button
                className={`run-row ${run.runId === selectedRunId ? 'active' : ''}`}
                key={run.runId}
                type="button"
                onClick={() => selectRun(run.runId)}
              >
                <strong>{run.workflow}</strong>
                <span>{run.currentStep ?? statusLabel(run.status)}</span>
                <small>{run.completedCount + run.skippedCount}/{run.totalSteps} · {formatDate(run.updatedAt)}</small>
              </button>
            ))}
          </div>
          <div className="run-graph">
            <div className="panel-title">
              <Workflow size={16} />
              執行狀態
              {selectedRun && <span className="title-note">執行紀錄：{selectedRun.runId}</span>}
            </div>
            <StepLegend compact />
            {runGraphSource ? <MermaidChart chart={runGraphSource} /> : <EmptyState loading={loading} />}
            {selectedRun && (
              <RunDetails run={selectedRun} state={selectedRunState} />
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

function RunDetails({ run, state }: { run: WizardRunSummary; state: WizardRunState | null }) {
  const inputs = state?.inputs ?? {}
  const completedSteps = (state?.completed_steps ?? []).map(runStepId)
  const skippedSteps = (state?.skipped_steps ?? []).map(runStepId)
  const doneCount = run.completedCount + run.skippedCount
  const percent = run.totalSteps > 0 ? Math.round((doneCount / run.totalSteps) * 100) : 0
  const progressTitle = run.currentStep
    ? `正在第 ${Math.min(doneCount + 1, run.totalSteps)}/${run.totalSteps} 步`
    : run.status === 'completed'
      ? '流程已跑完'
      : statusLabel(run.status)
  const pendingSteps = (state?.steps ?? []).map(runStepId).filter(
    (step) => !completedSteps.includes(step) && !skippedSteps.includes(step),
  )

  return (
    <div className="run-details">
      <div className="run-progress">
        <div>
          <strong>{progressTitle}</strong>
          <span>{run.currentStep ?? statusLabel(run.status)}</span>
        </div>
        <div className="progress-track" aria-label={`執行進度 ${percent}%`}>
          <div style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="run-detail-grid">
        <span>狀態</span>
        <strong>{statusLabel(run.status)}</strong>
        <span>目前步驟</span>
        <strong>{run.currentStep ?? '已完成'}</strong>
        <span>進度</span>
        <strong>{run.completedCount + run.skippedCount}/{run.totalSteps}</strong>
        <span>更新時間</span>
        <strong>{formatDate(run.updatedAt)}</strong>
      </div>

      <div className="run-detail-section">
        <span>輸入內容</span>
        {Object.keys(inputs).length === 0 ? (
          <small>無</small>
        ) : (
          <pre>{JSON.stringify(inputs, null, 2)}</pre>
        )}
      </div>

      <div className="run-detail-section">
        <span>尚未執行的步驟</span>
        {pendingSteps.length === 0 ? (
          <small>無</small>
        ) : (
          <div className="run-step-pills">
            {pendingSteps.map((step) => <small key={step}>{step}</small>)}
          </div>
        )}
      </div>

      <div className="run-state-path" title={run.statePath}>{run.statePath}</div>
    </div>
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
      <strong>{loading ? '讀取中' : '目前沒有可顯示的流程圖'}</strong>
      <span>選擇專案和流程後會在這裡顯示。</span>
    </div>
  )
}

function StarterGuide({
  project,
  selectedWorkflow,
  selectedRun,
  requiredInputCount,
}: {
  project: ProjectDetail | null
  selectedWorkflow: string
  selectedRun?: WizardRunSummary
  requiredInputCount: number
}) {
  const items = [
    {
      title: '選一個專案',
      detail: project ? project.name : '先從左邊挑一個接入 workflow 的專案',
      done: Boolean(project),
    },
    {
      title: '挑一條流程',
      detail: selectedWorkflow || '像選 Scratch 作品一樣，先挑要跑的流程',
      done: Boolean(selectedWorkflow),
    },
    {
      title: '按開始執行',
      detail: selectedRun
        ? `${statusLabel(selectedRun.status)} · ${selectedRun.completedCount + selectedRun.skippedCount}/${selectedRun.totalSteps}`
        : requiredInputCount > 0
          ? `先填 ${requiredInputCount} 個必填欄位，再按上方的開始執行`
          : '可以直接按上方的開始執行',
      done: Boolean(selectedRun),
    },
  ]

  return (
    <section className="starter-guide" aria-label="快速開始">
      {items.map((item, index) => (
        <div className={`starter-step ${item.done ? 'done' : ''}`} key={item.title}>
          <span>{index + 1}</span>
          <div>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </div>
        </div>
      ))}
    </section>
  )
}

function StepLegend({ compact = false }: { compact?: boolean }) {
  const items = compact
    ? ['ai', 'shell', 'code-edit', 'file']
    : ['ai', 'shell', 'tool-or-shell', 'tool-or-code-edit', 'code-edit', 'file']
  return (
    <div className={`step-legend ${compact ? 'compact' : ''}`}>
      {items.map((type) => {
        const meta = stepTypeMeta(type)
        return (
          <span className={meta.className} key={type}>
            <i />
            {meta.label}
          </span>
        )
      })}
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

function friendlyErrorMessage(error: unknown): string {
  const message = errorMessage(error)
  if (message.includes('缺少必要輸入')) return `${message}。請把有 * 的格子填完再開始。`
  if (message.includes('workflow content is empty')) return 'workflow 內容是空的。請先放入流程內容再驗證或儲存。'
  if (message.includes('Unknown project')) return '找不到這個專案。請重新掃描後再試一次。'
  if (message.includes('timed out') || message.includes('timeout')) return '執行等太久了。請確認 ai-mc 指令沒有卡住，再重新試一次。'
  if (message.includes('ENOENT')) return '找不到需要的檔案或指令。請確認專案路徑和 ai-mc CLI 設定正確。'
  return message
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

function countLabel(count: number, unit: string): string {
  return `${count} ${unit}`
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: '已完成',
    blocked: '等待處理',
    running: '執行中',
    pending: '尚未開始',
    failed: '失敗',
    cancelled: '已取消',
  }
  return labels[status] ?? status
}

function stepTypeMeta(type: string): { label: string; hint: string; className: string } {
  const map: Record<string, { label: string; hint: string; className: string }> = {
    ai: {
      label: '請 AI 想一想',
      hint: '適合整理、判斷、寫說明',
      className: 'type-ai',
    },
    shell: {
      label: '請電腦執行指令',
      hint: '適合跑測試、建置、查狀態',
      className: 'type-shell',
    },
    'tool-or-shell': {
      label: '用工具或指令',
      hint: '可以交給工具，也可以跑命令',
      className: 'type-tool',
    },
    'tool-or-code-edit': {
      label: '用工具或改檔案',
      hint: '適合讓 AI 實作一小段改動',
      className: 'type-edit',
    },
    file: {
      label: '讀寫檔案',
      hint: '適合產生或檢查檔案',
      className: 'type-file',
    },
    'code-edit': {
      label: '修改程式',
      hint: '適合真的改程式碼',
      className: 'type-edit',
    },
  }
  return map[type] ?? {
    label: type,
    hint: '自訂步驟類型',
    className: 'type-tool',
  }
}

function inputPlaceholder(inputName: string, required: boolean, summary: WorkflowSummary): string {
  const example = summary.inputExamples?.[inputName]
  if (example) return `例：${example}`
  return required ? '必填' : '選填'
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

function runStepId(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id?: unknown }).id ?? '')
  }
  return String(value ?? '')
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
