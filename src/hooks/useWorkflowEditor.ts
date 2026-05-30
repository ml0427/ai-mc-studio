import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import YAML from 'yaml'
import { uniqueStepId } from '../data/stepTemplates'
import { parseWorkflowSpec } from '../lib/workflowYaml'
import type { ProjectDetail, StepTemplate, ToastState, WorkflowStep } from '../types/workflow'

export function useWorkflowEditor({
  project,
  selectedWorkflow,
  selectedStepId,
  setSelectedStepId,
  setToast,
}: {
  project: ProjectDetail | null
  selectedWorkflow: string
  selectedStepId: string
  setSelectedStepId: Dispatch<SetStateAction<string>>
  setToast: (toast: ToastState) => void
}) {
  const [editorValue, setEditorValue] = useState('')
  const [editorUndoStack, setEditorUndoStack] = useState<string[]>([])
  const editorValueRef = useRef(editorValue)

  const editorSpec = useMemo(() => parseWorkflowSpec(editorValue, project?.spec), [editorValue, project])
  const workflow = selectedWorkflow
    ? editorSpec.spec?.workflows?.[selectedWorkflow]
    : null
  const steps = useMemo(() => workflow?.steps ?? [], [workflow])
  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? steps[0]
  const isDirty = Boolean(project && editorValue !== project.rawYaml)
  const canUndoEditor = editorUndoStack.length > 0

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

  function addStepFromTemplate(template: StepTemplate, options: { afterStepId?: string; when?: string } = {}) {
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
    if (options.when?.trim()) nextStep.when = options.when.trim()
    const afterIndex = options.afterStepId && options.afterStepId !== '__entry__'
      ? currentSteps.findIndex((step) => step.id === options.afterStepId)
      : currentSteps.length - 1
    const insertIndex = options.afterStepId === '__entry__'
      ? 0
      : afterIndex >= 0 ? afterIndex + 1 : currentSteps.length
    targetWorkflow.steps = [
      ...currentSteps.slice(0, insertIndex),
      nextStep,
      ...currentSteps.slice(insertIndex),
    ]
    commitEditorValue(YAML.stringify(parsed.spec))
    setSelectedStepId(nextId)
    setToast({ tone: 'info', message: `已加入積木：${template.label}` })
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

  return {
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
  }
}
