import { useEffect, useMemo, useRef, useState } from 'react'
import mermaid from 'mermaid'
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  FolderKanban,
  GitBranch,
  RefreshCw,
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
}

type ProjectSummary = {
  id: string
  name: string
  rootPath: string
  workflowPath: string
  workflowCount: number
  stepCount: number
  workflows: WorkflowSummary[]
  scannedAt: string
}

type ProjectDetail = ProjectSummary & {
  spec: WorkflowSpec
  rawYaml: string
}

type ToastState = {
  tone: 'ok' | 'error' | 'info'
  message: string
}

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'base',
  themeVariables: {
    fontFamily: 'Aptos, Segoe UI, sans-serif',
  },
})

function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsRoot, setProjectsRoot] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState('')
  const [selectedStepId, setSelectedStepId] = useState('')
  const [graphSource, setGraphSource] = useState('')
  const [editorValue, setEditorValue] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [loading, setLoading] = useState(false)

  const workflow = selectedWorkflow
    ? project?.spec.workflows?.[selectedWorkflow]
    : null
  const steps = useMemo(() => workflow?.steps ?? [], [workflow])
  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? steps[0]

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
  }, [selectedProjectId])

  useEffect(() => {
    if (!project || !selectedWorkflow) return
    void loadGraph(project.id, selectedWorkflow)
  }, [project, selectedWorkflow])

  async function loadProjects() {
    setLoading(true)
    try {
      const data = await api<{ projectsRoot: string; projects: ProjectSummary[] }>('/api/projects')
      setProjectsRoot(data.projectsRoot)
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

  async function validateProject() {
    if (!project) return
    try {
      const result = await api<{ ok: boolean; output: string }>(`/api/projects/${project.id}/validate`, {
        method: 'POST',
      })
      setToast({ tone: 'ok', message: result.output.trim() })
    } catch (error) {
      setToast({ tone: 'error', message: errorMessage(error) })
    }
  }

  async function saveWorkflow() {
    if (!project) return
    try {
      const result = await api<{ ok: boolean; backupPath: string; project: ProjectDetail }>(
        `/api/projects/${project.id}/workflow`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: editorValue }),
        },
      )
      setProject(result.project)
      setEditorValue(result.project.rawYaml)
      selectWorkflow(result.project, selectedWorkflow)
      setToast({ tone: 'ok', message: `已儲存，備份在 ${result.backupPath}` })
      await loadProjects()
    } catch (error) {
      setToast({ tone: 'error', message: errorMessage(error) })
    }
  }

  function selectWorkflow(targetProject: ProjectDetail, workflowName: string) {
    const nextWorkflow = targetProject.spec.workflows?.[workflowName]
      ? workflowName
      : targetProject.workflows[0]?.name ?? ''
    setSelectedWorkflow(nextWorkflow)
    setSelectedStepId(targetProject.spec.workflows?.[nextWorkflow]?.steps?.[0]?.id ?? '')
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

        <div className="rail-caption">掃描根目錄</div>
        <div className="path-chip" title={projectsRoot}>{projectsRoot || '尚未載入'}</div>

        <section className="project-list" aria-label="Projects">
          {projects.map((item) => (
            <button
              className={`project-row ${item.id === selectedProjectId ? 'active' : ''}`}
              key={item.id}
              type="button"
              onClick={() => setSelectedProjectId(item.id)}
            >
              <FolderKanban size={17} />
              <span>
                <strong>{item.name}</strong>
                <small>{item.workflowCount} workflows · {item.stepCount} steps</small>
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
          </div>
          <div className="header-actions">
            <button type="button" onClick={validateProject} disabled={!project}>
              <CheckCircle2 size={16} />
              驗證
            </button>
            <button type="button" className="primary" onClick={saveWorkflow} disabled={!project}>
              <Save size={16} />
              儲存 YAML
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
                <span>{item.stepCount} steps</span>
              </button>
            ))}
          </nav>

          <section className="graph-panel">
            <div className="panel-title">
              <Workflow size={16} />
              Workflow Map
            </div>
            {graphSource ? <MermaidChart chart={graphSource} /> : <EmptyState loading={loading} />}
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
            <pre className="yaml-view">
              {selectedStep ? YAML.stringify(selectedStep) : '尚未選擇 step'}
            </pre>
          </aside>
        </div>

        <section className="editor-panel">
          <div className="panel-title">
            <FileCode2 size={16} />
            workflow.yaml
          </div>
          <textarea
            spellCheck={false}
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
          />
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

    mermaid.render(id, chart)
      .then(({ svg }) => {
        if (!cancelled && elementRef.current) {
          elementRef.current.innerHTML = svg
          setError('')
        }
      })
      .catch((reason) => {
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

export default App
