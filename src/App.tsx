import { useEffect, useState, type DragEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode2,
  RotateCcw,
  Undo2,
  Workflow,
} from 'lucide-react'
import { api } from './api/studioApi'
import { STEP_TEMPLATES } from './data/stepTemplates'
import { EmptyState } from './components/EmptyState'
import { MermaidChart } from './components/MermaidChart'
import { ProjectRail } from './components/ProjectRail'
import { RunPanel } from './components/RunPanel'
import { StageBlocks } from './components/StageBlocks'
import { StarterGuide } from './components/StarterGuide'
import { StepInspector } from './components/StepInspector'
import { StepLegend } from './components/StepSummary'
import { WorkbenchHeader } from './components/WorkbenchHeader'
import { WorkflowPanel } from './components/WorkflowPanel'
import { useProjects } from './hooks/useProjects'
import { useRuns } from './hooks/useRuns'
import { useWorkflowEditor } from './hooks/useWorkflowEditor'
import { buildClientMermaid } from './lib/workflowYaml'
import {
  friendlyErrorMessage,
} from './lib/format'
import type {
  ProjectDetail,
  ToastState,
  ValidationResult,
  WizardRunSummary,
  WorkflowSummary,
} from './types/workflow'
import './App.css'

function App() {
  const [selectedWorkflow, setSelectedWorkflow] = useState('')
  const [selectedStepId, setSelectedStepId] = useState('')
  const [graphSource, setGraphSource] = useState('')
  const [runInputValues, setRunInputValues] = useState<Record<string, string>>({})
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false)
  const {
    projectsRoot,
    scanDepth,
    projectFilter,
    filteredProjects,
    selectedProjectId,
    project,
    loadingProjects,
    loadProjects,
    selectProject: requestProjectSelection,
    setProject,
    setProjectFilter,
  } = useProjects({
    setToast,
    onProjectLoaded: (detail) => {
      selectWorkflow(detail, detail.workflows[0]?.name ?? '')
      resetEditorHistory(detail.rawYaml)
    },
  })
  const loading = loadingProjects
  const {
    runs,
    selectedRunId,
    selectedRun,
    selectedRunState,
    runGraphSource,
    loadRuns,
    refreshRuns,
    selectRun,
  } = useRuns({
    project,
    setToast,
  })
  const {
    editorValue,
    editorUndoStack,
    editorSpec,
    workflow,
    steps,
    selectedStep,
    isDirty,
    canUndoEditor,
    commitEditorValue,
    resetEditorHistory,
    undoEditorValue,
    updateSelectedStep,
    updateSelectedStepPatch,
    addStepFromTemplate,
    reorderStep,
    duplicateStep,
    deleteStep,
  } = useWorkflowEditor({
    project,
    selectedWorkflow,
    selectedStepId,
    setSelectedStepId,
    setToast,
  })
  const selectedWorkflowSummary = project?.workflows.find((item) => item.name === selectedWorkflow)
  const hasRunInputExamples = Boolean(
    selectedWorkflowSummary?.inputExamples
    && Object.keys(selectedWorkflowSummary.inputExamples).length > 0,
  )
  const displayedWorkflowGraph = isDirty && workflow && selectedWorkflow
    ? buildClientMermaid(selectedWorkflow, workflow)
    : graphSource

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
    function confirmLeave(event: BeforeUnloadEvent) {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', confirmLeave)
    return () => window.removeEventListener('beforeunload', confirmLeave)
  }, [isDirty])

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

  useEffect(() => {
    if (!project || !selectedWorkflow) return undefined
    const timeoutId = window.setTimeout(() => {
      void loadGraph(project.id, selectedWorkflow)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [project, selectedWorkflow])

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
    const canSwitch = !isDirty || window.confirm('目前 workflow.yaml 尚未儲存，確定要切換專案？')
    requestProjectSelection(projectId, canSwitch)
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

  function handleStageDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/x-step-type')
    const template = STEP_TEMPLATES.find((item) => item.type === type)
    if (template) addStepFromTemplate(template)
  }

  return (
    <main className="studio-shell">
      <ProjectRail
        projectsRoot={projectsRoot}
        scanDepth={scanDepth}
        projectFilter={projectFilter}
        filteredProjects={filteredProjects}
        selectedProjectId={selectedProjectId}
        onProjectFilterChange={setProjectFilter}
        onLoadProjects={loadProjects}
        onSelectProject={selectProject}
      />

      <section className="workbench">
        <WorkbenchHeader
          project={project}
          selectedWorkflow={selectedWorkflow}
          isDirty={isDirty}
          canUndoEditor={canUndoEditor}
          onValidateProject={validateProject}
          onStartRun={startRun}
          onUndoEditor={undoEditorValue}
          onSaveWorkflow={saveWorkflow}
        />

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
          <WorkflowPanel
            project={project}
            selectedWorkflow={selectedWorkflow}
            onSelectWorkflow={(workflowName) => project && selectWorkflow(project, workflowName)}
            onAddStep={addStepFromTemplate}
          />

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

          <StepInspector
            steps={steps}
            selectedStep={selectedStep}
            workflow={workflow}
            error={editorSpec.error}
            onSelectStep={setSelectedStepId}
            onUpdateStep={updateSelectedStep}
            onPatchStep={updateSelectedStepPatch}
          />
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

        <RunPanel
          project={project}
          selectedWorkflow={selectedWorkflow}
          selectedWorkflowSummary={selectedWorkflowSummary}
          hasRunInputExamples={hasRunInputExamples}
          runInputValues={runInputValues}
          runs={runs}
          selectedRunId={selectedRunId}
          selectedRun={selectedRun}
          selectedRunState={selectedRunState}
          runGraphSource={runGraphSource}
          loading={loading}
          onFillRunInputExamples={fillRunInputExamples}
          onUpdateRunInput={updateRunInput}
          onRefreshRuns={refreshRuns}
          onSelectRun={selectRun}
          onSelectStep={setSelectedStepId}
        />
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
