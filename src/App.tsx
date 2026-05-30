import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FolderKanban,
  GitBranch,
  History,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Undo2,
  Workflow,
} from 'lucide-react'
import YAML from 'yaml'
import { api } from './api/studioApi'
import { STEP_TEMPLATES, stepTypeMeta, uniqueStepId } from './data/stepTemplates'
import { BlockToolbox } from './components/BlockToolbox'
import { EmptyState } from './components/EmptyState'
import { MermaidChart } from './components/MermaidChart'
import { RunDetails } from './components/RunDetails'
import { StageBlocks } from './components/StageBlocks'
import { StarterGuide } from './components/StarterGuide'
import { StepSpecificFields } from './components/StepSpecificFields'
import { SelectedStepSummary, StepLegend } from './components/StepSummary'
import { buildClientMermaid, parseWorkflowSpec } from './lib/workflowYaml'
import {
  countLabel,
  formatDate,
  friendlyErrorMessage,
  inputPlaceholder,
  statusLabel,
} from './lib/format'
import type {
  ProjectDetail,
  ProjectSummary,
  StepTemplate,
  ToastState,
  ValidationResult,
  WizardRunState,
  WizardRunSummary,
  WorkflowStep,
  WorkflowSummary,
} from './types/workflow'
import './App.css'

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
  const [editorUndoStack, setEditorUndoStack] = useState<string[]>([])
  const [runs, setRuns] = useState<WizardRunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [runGraphSource, setRunGraphSource] = useState('')
  const [selectedRunState, setSelectedRunState] = useState<WizardRunState | null>(null)
  const [runInputValues, setRunInputValues] = useState<Record<string, string>>({})
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false)
  const editorValueRef = useRef(editorValue)

  const editorSpec = useMemo(() => parseWorkflowSpec(editorValue, project?.spec), [editorValue, project])
  const workflow = selectedWorkflow
    ? editorSpec.spec?.workflows?.[selectedWorkflow]
    : null
  const steps = useMemo(() => workflow?.steps ?? [], [workflow])
  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? steps[0]
  const selectedWorkflowSummary = project?.workflows.find((item) => item.name === selectedWorkflow)
  const selectedRun = runs.find((run) => run.runId === selectedRunId)
  const isDirty = Boolean(project && editorValue !== project.rawYaml)
  const canUndoEditor = editorUndoStack.length > 0
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

  const commitEditorValue = useCallback((nextValue: string, options: { recordUndo?: boolean } = {}) => {
    const currentValue = editorValueRef.current
    if (nextValue === currentValue) return

    if (options.recordUndo !== false) {
      setEditorUndoStack((current) => [...current.slice(-99), currentValue])
    }
    editorValueRef.current = nextValue
    setEditorValue(nextValue)
  }, [])

  const resetEditorHistory = useCallback((nextValue: string) => {
    editorValueRef.current = nextValue
    setEditorValue(nextValue)
    setEditorUndoStack([])
  }, [])

  const undoEditorValue = useCallback(() => {
    setEditorUndoStack((current) => {
      const previousValue = current.at(-1)
      if (previousValue === undefined) return current
      editorValueRef.current = previousValue
      setEditorValue(previousValue)
      return current.slice(0, -1)
    })
  }, [])

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
    function handleUndo(event: KeyboardEvent) {
      const isUndo = (event.ctrlKey || event.metaKey)
        && !event.shiftKey
        && !event.altKey
        && event.key.toLowerCase() === 'z'
      if (!isUndo || editorUndoStack.length === 0) return
      if (!shouldHandleWorkflowUndo(event.target)) return
      event.preventDefault()
      undoEditorValue()
    }

    window.addEventListener('keydown', handleUndo)
    return () => window.removeEventListener('keydown', handleUndo)
  }, [editorUndoStack.length, undoEditorValue])

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
        resetEditorHistory(detail.rawYaml)
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
  }, [loadRuns, resetEditorHistory, selectedProjectId])

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
      resetEditorHistory(result.project.rawYaml)
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
    updateSelectedStepPatch((step) => {
      if (value.trim()) {
        step[field] = value
      } else if (field !== 'type') {
        delete step[field]
      }
    })
  }

  function updateSelectedStepPatch(updater: (step: WorkflowStep) => void) {
    const parsed = parseWorkflowSpec(editorValue, null)
    if (!parsed.spec || !selectedWorkflow || !selectedStep?.id) {
      setToast({ tone: 'error', message: parsed.error ?? 'workflow.yaml 目前無法解析' })
      return
    }

    const step = parsed.spec.workflows?.[selectedWorkflow]?.steps?.find((item) => item.id === selectedStep.id)
    if (!step) return

    updater(step)
    commitEditorValue(YAML.stringify(parsed.spec))
  }

  function addStepFromTemplate(template: StepTemplate) {
    const parsed = parseWorkflowSpec(editorValue, null)
    if (!parsed.spec || !selectedWorkflow) {
      setToast({ tone: 'error', message: parsed.error ?? '目前還沒有可以加入積木的流程' })
      return
    }

    const targetWorkflow = parsed.spec.workflows?.[selectedWorkflow]
    if (!targetWorkflow) {
      setToast({ tone: 'error', message: '請先挑一條流程，再加入積木。' })
      return
    }

    const currentSteps = targetWorkflow.steps ?? []
    const nextId = uniqueStepId(currentSteps, template.outputPrefix)
    const nextStep: WorkflowStep = {
      id: nextId,
      type: template.type,
      output: nextId,
    }
    targetWorkflow.steps = [...currentSteps, nextStep]
    commitEditorValue(YAML.stringify(parsed.spec))
    setSelectedStepId(nextId)
    setToast({ tone: 'info', message: `已加入積木：${template.label}` })
  }

  function handleStageDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/x-step-type')
    const template = STEP_TEMPLATES.find((item) => item.type === type)
    if (template) addStepFromTemplate(template)
  }

  function reorderStep(fromIndex: number, toIndex: number) {
    const parsed = parseWorkflowSpec(editorValue, null)
    const targetSteps = selectedWorkflow ? parsed.spec?.workflows?.[selectedWorkflow]?.steps : null
    if (!parsed.spec || !targetSteps || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    if (fromIndex >= targetSteps.length || toIndex >= targetSteps.length) return

    const nextSteps = [...targetSteps]
    const [movedStep] = nextSteps.splice(fromIndex, 1)
    nextSteps.splice(toIndex, 0, movedStep)
    const workflowTarget = parsed.spec.workflows?.[selectedWorkflow]
    if (!workflowTarget) return
    workflowTarget.steps = nextSteps
    commitEditorValue(YAML.stringify(parsed.spec))
    setSelectedStepId(movedStep.id)
  }

  function duplicateStep(stepId: string) {
    const parsed = parseWorkflowSpec(editorValue, null)
    const targetSteps = selectedWorkflow ? parsed.spec?.workflows?.[selectedWorkflow]?.steps : null
    if (!parsed.spec || !targetSteps) return
    const index = targetSteps.findIndex((step) => step.id === stepId)
    if (index < 0) return
    const original = targetSteps[index]
    const nextId = uniqueStepId(targetSteps, `${original.id}_copy`)
    const clone: WorkflowStep = {
      ...structuredClone(original),
      id: nextId,
      output: original.output ? `${nextId}_output` : nextId,
    }
    const workflowTarget = parsed.spec.workflows?.[selectedWorkflow]
    if (!workflowTarget) return
    workflowTarget.steps = [
      ...targetSteps.slice(0, index + 1),
      clone,
      ...targetSteps.slice(index + 1),
    ]
    commitEditorValue(YAML.stringify(parsed.spec))
    setSelectedStepId(nextId)
    setToast({ tone: 'info', message: `已複製積木：${original.id}` })
  }

  function deleteStep(stepId: string) {
    const parsed = parseWorkflowSpec(editorValue, null)
    const targetSteps = selectedWorkflow ? parsed.spec?.workflows?.[selectedWorkflow]?.steps : null
    if (!parsed.spec || !targetSteps) return
    const step = targetSteps.find((item) => item.id === stepId)
    if (!step) return
    if (!window.confirm(`要拿掉「${step.id}」這塊積木嗎？可以用復原救回來。`)) return

    const workflowTarget = parsed.spec.workflows?.[selectedWorkflow]
    if (!workflowTarget) return
    workflowTarget.steps = targetSteps.filter((item) => item.id !== stepId)
    commitEditorValue(YAML.stringify(parsed.spec))
    setSelectedStepId(workflowTarget.steps[0]?.id ?? '')
    setToast({ tone: 'info', message: `已拿掉積木：${step.id}` })
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
            <button type="button" onClick={undoEditorValue} disabled={!canUndoEditor}>
              <Undo2 size={16} />
              復原
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
          <nav className="workflow-panel block-toolbox" aria-label="流程和積木工具箱">
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
            <BlockToolbox onAddStep={addStepFromTemplate} />
          </nav>

          <section
            className="graph-panel stage-panel"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleStageDrop}
          >
            <div className="panel-title">
              <Workflow size={16} />
              舞台
              {isDirty && <span className="title-note dirty">草稿預覽</span>}
            </div>
            <StepLegend />
            {displayedWorkflowGraph ? (
              <MermaidChart
                chart={displayedWorkflowGraph}
                steps={steps}
                selectedStepId={selectedStep?.id}
                onSelectStep={setSelectedStepId}
              />
            ) : <EmptyState loading={loading} />}
            <StageBlocks
              steps={steps}
              selectedStepId={selectedStep?.id}
              onSelectStep={setSelectedStepId}
              onReorderStep={reorderStep}
              onDuplicateStep={duplicateStep}
              onDeleteStep={deleteStep}
            />
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
                <StepSpecificFields
                  step={selectedStep}
                  workflow={workflow}
                  onPatchStep={updateSelectedStepPatch}
                />
              </div>
            )}
            <SelectedStepSummary step={selectedStep} error={editorSpec.error} />
          </aside>
        </div>

        <section className={`editor-panel advanced-panel ${showAdvancedEditor ? 'open' : ''}`}>
          <button
            className="advanced-toggle"
            type="button"
            onClick={() => setShowAdvancedEditor((current) => !current)}
          >
            {showAdvancedEditor ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>
              <strong>進階流程原始檔</strong>
              <small>需要直接調整 workflow.yaml 時再打開</small>
            </span>
            {isDirty && <i>尚未儲存</i>}
          </button>
          {showAdvancedEditor && (
            <>
              <div className="panel-title">
                <FileCode2 size={16} />
                workflow.yaml
                <button className="icon-action" type="button" onClick={undoEditorValue} disabled={!canUndoEditor}>
                  <Undo2 size={14} />
                  復原
                </button>
                <button className="icon-action" type="button" onClick={() => project && commitEditorValue(project.rawYaml)} disabled={!isDirty}>
                  <RotateCcw size={14} />
                  還原
                </button>
              </div>
              <textarea
                spellCheck={false}
                value={editorValue}
                onChange={(event) => commitEditorValue(event.target.value)}
              />
            </>
          )}
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
              <RunDetails
                run={selectedRun}
                state={selectedRunState}
                onSelectStep={setSelectedStepId}
              />
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

function shouldHandleWorkflowUndo(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true
  const tagName = target.tagName.toLowerCase()
  const isTextInput = tagName === 'input' || tagName === 'textarea' || target.isContentEditable
  if (!isTextInput) return true
  return Boolean(target.closest('.step-editor') || target.closest('.editor-panel'))
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

export default App
