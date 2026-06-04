import { Search, X } from 'lucide-react'

type CommandAction = {
  id: string
  hint: string
  label: string
  onRun: () => void
}

type CommandPaletteProps = {
  actions: CommandAction[]
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ actions, isOpen, onClose }: CommandPaletteProps) {
  if (!isOpen) return null

  return (
    <div className="command-backdrop" role="presentation" onClick={onClose}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(event) => event.stopPropagation()}>
        <div className="command-input-row">
          <Search size={16} />
          <span>輸入指令或直接選擇動作</span>
          <button type="button" onClick={onClose} aria-label="關閉 command palette">
            <X size={16} />
          </button>
        </div>
        <div className="command-list">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                action.onRun()
                onClose()
              }}
            >
              <strong>{action.label}</strong>
              <span>{action.hint}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
