import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/studioApi'
import { friendlyErrorMessage } from '../lib/format'
import type { ProjectDetail, ToastState, WizardRunState, WizardRunSummary } from '../types/workflow'

type LoadRunsOptions = {
  quiet?: boolean
}

export function useRuns({
  project,
  setToast,
}: {
  project: ProjectDetail | null
  setToast: (toast: ToastState) => void
}) {
  const projectId = project?.id ?? ''
  const [runs, setRuns] = useState<WizardRunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [runGraphSource, setRunGraphSource] = useState('')
  const [selectedRunState, setSelectedRunState] = useState<WizardRunState | null>(null)
  const selectedRun = useMemo(
    () => runs.find((run) => run.runId === selectedRunId),
    [runs, selectedRunId],
  )

  const loadRunGraph = useCallback(async (targetProjectId: string, runId: string) => {
    try {
      const response = await fetch(`/api/projects/${targetProjectId}/runs/${encodeURIComponent(runId)}/graph`)
      if (!response.ok) throw new Error(await response.text())
      setRunGraphSource(await response.text())
    } catch (error) {
      setRunGraphSource('')
      setToast({ tone: 'error', message: friendlyErrorMessage(error) })
    }
  }, [setToast])

  const loadRunState = useCallback(async (targetProjectId: string, runId: string) => {
    try {
      setSelectedRunState(await api<WizardRunState>(`/api/projects/${targetProjectId}/runs/${encodeURIComponent(runId)}`))
    } catch (error) {
      setSelectedRunState(null)
      setToast({ tone: 'error', message: friendlyErrorMessage(error) })
    }
  }, [setToast])

  const loadRuns = useCallback(async (
    targetProjectId: string,
    preferredRunId = '',
    options: LoadRunsOptions = {},
  ) => {
    try {
      const data = await api<{ runs: WizardRunSummary[] }>(`/api/projects/${targetProjectId}/runs`)
      const nextRunId = data.runs.some((run) => run.runId === preferredRunId)
        ? preferredRunId
        : data.runs[0]?.runId || ''

      setRuns(data.runs)
      setSelectedRunId(nextRunId)

      if (!nextRunId) {
        setRunGraphSource('')
        setSelectedRunState(null)
        return
      }

      await Promise.all([
        loadRunGraph(targetProjectId, nextRunId),
        loadRunState(targetProjectId, nextRunId),
      ])
    } catch (error) {
      setRuns([])
      setSelectedRunId('')
      setRunGraphSource('')
      setSelectedRunState(null)
      if (!options.quiet) setToast({ tone: 'error', message: friendlyErrorMessage(error) })
    }
  }, [loadRunGraph, loadRunState, setToast])

  const refreshRuns = useCallback(() => {
    if (!projectId) return
    void loadRuns(projectId, selectedRunId)
  }, [loadRuns, projectId, selectedRunId])

  const selectRun = useCallback((runId: string) => {
    setSelectedRunId(runId)
    if (!projectId) return
    void loadRunGraph(projectId, runId)
    void loadRunState(projectId, runId)
  }, [loadRunGraph, loadRunState, projectId])

  useEffect(() => {
    if (!projectId) return undefined
    const timeoutId = window.setTimeout(() => {
      void loadRuns(projectId)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadRuns, projectId])

  useEffect(() => {
    if (!projectId) return undefined
    const intervalId = window.setInterval(() => {
      void loadRuns(projectId, selectedRunId, { quiet: true })
    }, 5000)
    return () => window.clearInterval(intervalId)
  }, [loadRuns, projectId, selectedRunId])

  return {
    runs,
    selectedRunId,
    selectedRun,
    selectedRunState,
    runGraphSource,
    loadRuns,
    refreshRuns,
    selectRun,
  }
}
