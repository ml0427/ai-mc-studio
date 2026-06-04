import { PanelRight } from 'lucide-react'

import { nodeTypeLabels } from '../workflow/templates'
import type { EditableField, WorkflowNode } from '../workflow/types'

type SettingsPanelProps = {
  selectedNode: WorkflowNode | null
  onUpdateSelectedNode: (field: EditableField, value: string) => void
}

export function SettingsPanel({ selectedNode, onUpdateSelectedNode }: SettingsPanelProps) {
  return (
    <aside className="settings-panel" aria-label="節點設定">
      <div className="panel-title">
        <PanelRight size={18} />
        <strong>節點設定</strong>
      </div>

      {selectedNode ? (
        <form className="settings-form">
          <div className={`kind-pill type-${selectedNode.data.kind}`}>
            {nodeTypeLabels[selectedNode.data.kind]}
          </div>
          <label>
            <span>標題</span>
            <input
              value={selectedNode.data.title}
              onChange={(event) => onUpdateSelectedNode('title', event.target.value)}
            />
          </label>
          <label>
            <span>說明</span>
            <textarea
              value={selectedNode.data.description}
              onChange={(event) => onUpdateSelectedNode('description', event.target.value)}
            />
          </label>
          <label>
            <span>目的</span>
            <textarea
              value={selectedNode.data.purpose}
              onChange={(event) => onUpdateSelectedNode('purpose', event.target.value)}
              placeholder="這一步為什麼存在？它要幫後續流程解決什麼問題？"
            />
          </label>
          <label>
            <span>執行指示</span>
            <textarea
              value={selectedNode.data.instructions}
              onChange={(event) => onUpdateSelectedNode('instructions', event.target.value)}
              placeholder="一行一個指示，例如：整理成白話、列出驗收條件"
            />
          </label>
          <label>
            <span>判斷規則</span>
            <textarea
              value={selectedNode.data.decisionRules}
              onChange={(event) => onUpdateSelectedNode('decisionRules', event.target.value)}
              placeholder="條件節點用：什麼情況走是？什麼情況走否？"
            />
          </label>
          <label>
            <span>輸入</span>
            <input
              value={selectedNode.data.input}
              onChange={(event) => onUpdateSelectedNode('input', event.target.value)}
              placeholder="例如：上一個節點的輸出"
            />
          </label>
          <label>
            <span>輸出</span>
            <input
              value={selectedNode.data.output}
              onChange={(event) => onUpdateSelectedNode('output', event.target.value)}
              placeholder={selectedNode.id}
            />
          </label>
        </form>
      ) : (
        <div className="empty-settings">
          <strong>還沒選節點</strong>
          <span>點一下畫布上的節點，就能在這裡編輯內容。</span>
        </div>
      )}
    </aside>
  )
}
