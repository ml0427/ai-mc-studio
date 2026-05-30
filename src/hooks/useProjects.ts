import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/studioApi'
import { friendlyErrorMessage } from '../lib/format'
import type { ProjectDetail, ProjectSummary, ToastState } from '../types/workflow'

export function useProjects({
  onProjectLoaded,
  setToast,
}: {
  onProjectLoaded: (project: ProjectDetail) => void
  setToast: (toast: ToastState) => void
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsRoot, setProjectsRoot] = useState('')
  const [scanDepth, setScanDepth] = useState(0)
  const [projectFilter, setProjectFilter] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const onProjectLoadedRef = useRef(onProjectLoaded)

  useEffect(() => {
    onProjectLoadedRef.current = onProjectLoaded
  }, [onProjectLoaded])

  const filteredProjects = useMemo(() => {
    const keyword = projectFilter.trim().toLowerCase()
    if (!keyword) return projects

    return projects.filter((item) => [
      item.name,
      item.rootPath,
      ...item.workflows.map((workflowItem) => workflowItem.name),
    ].some((value) => value.toLowerCase().includes(keyword)))
  }, [projectFilter, projects])

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true)
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
      setLoadingProjects(false)
    }
  }, [setToast])

  const selectProject = useCallback((projectId: string, canSwitch = true) => {
    if (projectId === selectedProjectId || !canSwitch) return
    setSelectedProjectId(projectId)
  }, [selectedProjectId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProjects()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadProjects])

  useEffect(() => {
    if (!selectedProjectId) return undefined
    let cancelled = false

    async function readSelectedProject() {
      setLoadingProjects(true)
      try {
        const detail = await api<ProjectDetail>(`/api/projects/${selectedProjectId}`)
        if (cancelled) return
        setProject(detail)
        onProjectLoadedRef.current(detail)
      } catch (error) {
        if (!cancelled) setToast({ tone: 'error', message: friendlyErrorMessage(error) })
      } finally {
        if (!cancelled) setLoadingProjects(false)
      }
    }

    void readSelectedProject()

    return () => {
      cancelled = true
    }
  }, [selectedProjectId, setToast])

  return {
    projectsRoot,
    scanDepth,
    projectFilter,
    filteredProjects,
    selectedProjectId,
    project,
    loadingProjects,
    loadProjects,
    selectProject,
    setProject,
    setProjectFilter,
  }
}
