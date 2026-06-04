import { Bot, Circle, Code2, FileText, GitBranch, Hand, Plus, Square, Terminal, Wrench } from 'lucide-react'

import { nodeTemplateMetadata, toolboxGroups } from '../workflow/templates'
import type { WorkflowNodeKind } from '../workflow/types'

const nodeTemplateIcons: Record<WorkflowNodeKind, typeof Circle> = {
  start: Circle,
  ai_task: Bot,
  condition: GitBranch,
  human_check: Hand,
  output: Square,
  shell: Terminal,
  tool: Wrench,
  file: FileText,
  code_edit: Code2,
  terminal: Terminal,
}

const nodeTemplates = nodeTemplateMetadata.map((template) => ({
  ...template,
  icon: nodeTemplateIcons[template.kind],
}))

type NodePaletteProps = {
  onAddNode: (kind: WorkflowNodeKind) => void
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <div className="toolbox-list">
      {toolboxGroups.map((group) => (
        <section className="toolbox-group" key={group.title} aria-label={`${group.title}節點`}>
          <span>{group.title}</span>
          {group.kinds.map((kind) => {
            const template = nodeTemplates.find((item) => item.kind === kind) ?? nodeTemplates[1]
            const Icon = template.icon
            return (
              <button
                className={`toolbox-node type-${template.kind}`}
                key={template.kind}
                type="button"
                onClick={() => onAddNode(template.kind)}
              >
                <Icon size={18} />
                <span>
                  <strong>{template.title}</strong>
                  <small>{template.description}</small>
                </span>
                <Plus size={16} />
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}
