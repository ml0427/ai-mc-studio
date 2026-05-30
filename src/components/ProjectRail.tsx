import { FolderKanban, RefreshCw, Search, Workflow } from 'lucide-react'
import { countLabel } from '../lib/format'
import type { ProjectSummary } from '../types/workflow'

export function ProjectRail({
  projectsRoot,
  scanDepth,
  projectFilter,
  filteredProjects,
  selectedProjectId,
  onProjectFilterChange,
  onLoadProjects,
  onSelectProject,
}: {
  projectsRoot: string
  scanDepth: number
  projectFilter: string
  filteredProjects: ProjectSummary[]
  selectedProjectId: string
  onProjectFilterChange: (value: string) => void
  onLoadProjects: () => void
  onSelectProject: (projectId: string) => void
}) {
  return (
    <aside className="project-rail">
      <div className="brand-mark">
        <div className="brand-icon"><Workflow size={22} /></div>
        <div>
          <span>AI-MC</span>
          <strong>Studio</strong>
        </div>
      </div>

      <button className="rail-action" type="button" onClick={onLoadProjects}>
        <RefreshCw size={16} />
        重新掃描
      </button>

      <div className="rail-caption">掃描根目錄 · 層數 {scanDepth}</div>
      <div className="path-chip" title={projectsRoot}>{projectsRoot || '尚未載入'}</div>

      <label className="rail-search">
        <Search size={15} />
        <input
          value={projectFilter}
          onChange={(event) => onProjectFilterChange(event.target.value)}
          placeholder="搜尋專案或流程"
        />
      </label>

      <section className="project-list" aria-label="專案列表">
        {filteredProjects.map((item) => (
          <button
            className={`project-row ${item.id === selectedProjectId ? 'active' : ''}`}
            key={item.id}
            type="button"
            onClick={() => onSelectProject(item.id)}
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
  )
}
