import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode2,
  RotateCcw,
  Undo2,
} from 'lucide-react'
import { api } from './api/studioApi'
import { FlowCanvas } from './components/FlowCanvas'
import { ProjectRail } from './components/ProjectRail'
import { RunPanel } from './components/RunPanel'
import { StepInspector } from './components/StepInspector'
import { TaskLaunchPanel } from './components/TaskLaunchPanel'
import { WorkbenchHeader } from './components/WorkbenchHeader'
import { useProjects } from './hooks/useProjects'
import { useRuns } from './hooks/useRuns'
import { useWorkflowEditor } from './hooks/useWorkflowEditor'
import {
  friendlyErrorMessage,
} from './lib/format'
import type {
  ProjectDetail,
  ToastState,
  ValidationResult,
  WizardRunSummary,
  WorkflowStep,
  WorkflowSummary,
} from './types/workflow'
import './App.css'

function App() {
  const [selectedWorkflow, setSelectedWorkflow] = useState('')
  const [selectedStepId, setSelectedStepId] = useState('')
  const [runInputValues, setRunInputValues] = useState<Record<string, string>>({})
  const [runStartConfirm, setRunStartConfirm] = useState<{
    missingInputs: string[]
    outputs: string[]
    stepCount: number
  } | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(false)
  const [showLegacyRunTools, setShowLegacyRunTools] = useState(false)
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

  function runMissingInputs() {
    if (!selectedWorkflowSummary) return []
    return selectedWorkflowSummary.requiredInputs.filter(
      (inputName) => !runInputValues[inputName]?.trim(),
    )
  }

  function openRunStartConfirm() {
    if (!project || !selectedWorkflowSummary) return
    const missingInputs = runMissingInputs()
    setRunStartConfirm({
      missingInputs,
      outputs: runOutputNames(steps),
      stepCount: steps.length || selectedWorkflowSummary.stepCount,
    })
    if (missingInputs.length > 0) {
      setToast({ tone: 'error', message: `先補資料：${missingInputs.join('、')}` })
    }
  }

  async function confirmStartRun() {
    if (!project || !selectedWorkflowSummary) return
    const inputs: Record<string, string> = {}
    const missingInputs = runMissingInputs()

    if (missingInputs.length > 0) {
      setRunStartConfirm({
        missingInputs,
        outputs: runOutputNames(steps),
        stepCount: steps.length || selectedWorkflowSummary.stepCount,
      })
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
      setRunStartConfirm(null)
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
    setRunStartConfirm(null)
    setSelectedWorkflow(nextWorkflow)
    setSelectedStepId(targetProject.spec.workflows?.[nextWorkflow]?.steps?.[0]?.id ?? '')
    setRunInputValues(seedRunInputs(nextSummary))
  }

  function selectProject(projectId: string) {
    if (projectId === selectedProjectId) return
    const canSwitch = !isDirty || window.confirm('目前 workflow.yaml 尚未儲存，確定要切換專案？')
    if (canSwitch) setRunStartConfirm(null)
    requestProjectSelection(projectId, canSwitch)
  }

  function locateStepOnStage(stepId: string) {
    if (!stepId) return
    setSelectedStepId(stepId)
  }

  function updateRunInput(inputName: string, value: string) {
    setRunStartConfirm(null)
    setRunInputValues((current) => ({
      ...current,
      [inputName]: value,
    }))
  }

  function fillRunInputExamples() {
    if (!selectedWorkflowSummary?.inputExamples) return
    setRunStartConfirm(null)
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
          onStartRun={() => {
            setShowLegacyRunTools(true)
            openRunStartConfirm()
          }}
          onUndoEditor={undoEditorValue}
          onSaveWorkflow={saveWorkflow}
        />

        {toast && (
          <div className={`toast ${toast.tone}`}>
            {toast.tone === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.message}</span>
          </div>
        )}

        <FlowCanvas
          key={`${project?.id ?? 'no-project'}:${selectedWorkflow}`}
          project={project}
          selectedWorkflow={selectedWorkflow}
          selectedStepId={selectedStep?.id}
          steps={steps}
          loading={loading}
          onSelectWorkflow={(workflowName) => project && selectWorkflow(project, workflowName)}
          onSelectStep={setSelectedStepId}
          onAddStep={addStepFromTemplate}
          inspector={(
            <StepInspector
              steps={steps}
              selectedStep={selectedStep}
              workflow={workflow}
              error={editorSpec.error}
              onSelectStep={setSelectedStepId}
              onUpdateStep={updateSelectedStep}
              onPatchStep={updateSelectedStepPatch}
            />
          )}
        />

        <details
          className="legacy-run-details"
          open={showLegacyRunTools}
          onToggle={(event) => setShowLegacyRunTools(event.currentTarget.open)}
        >
          <summary>開始任務與執行紀錄</summary>
          <TaskLaunchPanel
            selectedWorkflow={selectedWorkflow}
            selectedWorkflowSummary={selectedWorkflowSummary}
            hasRunInputExamples={hasRunInputExamples}
            runInputValues={runInputValues}
            runStartConfirm={runStartConfirm}
            steps={steps}
            onFillRunInputExamples={fillRunInputExamples}
            onOpenRunStartConfirm={openRunStartConfirm}
            onCancelRunStartConfirm={() => setRunStartConfirm(null)}
            onConfirmStartRun={() => void confirmStartRun()}
            onUpdateRunInput={updateRunInput}
          />
          <RunPanel
            project={project}
            runs={runs}
            selectedRunId={selectedRunId}
            selectedRun={selectedRun}
            selectedRunState={selectedRunState}
            runGraphSource={runGraphSource}
            stageStepIds={steps.map((step) => step.id)}
            loading={loading}
            onRefreshRuns={refreshRuns}
            onSelectRun={selectRun}
            onSelectStep={locateStepOnStage}
          />
        </details>

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

function runOutputNames(steps: WorkflowStep[]): string[] {
  const outputs = new Set<string>()
  for (const step of steps) {
    const output = step.output?.trim()
    if (output) outputs.add(output)
  }
  return Array.from(outputs)
}

export default App
