import { PanelRight, Plus, Trash2 } from 'lucide-react'

import { defaultConditionBranchHandles, nodeTypeLabels } from '../workflow/templates'
import type { EditableField, WorkflowNode } from '../workflow/types'

type SettingsPanelProps = {
  selectedNode: WorkflowNode | null
  onAddBranch: () => void
  onRemoveBranch: (handleId: string) => void
  onRenameBranch: (handleId: string, label: string) => void
  onUpdateSelectedNode: (field: EditableField, value: string) => void
}

export function SettingsPanel({
  selectedNode,
  onAddBranch,
  onRemoveBranch,
  onRenameBranch,
  onUpdateSelectedNode,
}: SettingsPanelProps) {
  const branchHandles = selectedNode?.data.kind === 'condition'
    ? selectedNode.data.branchHandles?.length ? selectedNode.data.branchHandles : defaultConditionBranchHandles
    : []

  return (
    <aside className="settings-panel" aria-label="節點設定">
      <div className="panel-title">
        <PanelRight size={17} />
        <strong>Inspector</strong>
      </div>

      {selectedNode ? (
        <form className="settings-form">
          <div className="inspector-heading">
            <div className={`kind-pill type-${selectedNode.data.kind}`}>
              {nodeTypeLabels[selectedNode.data.kind]}
            </div>
            <span>{selectedNode.id}</span>
          </div>

          <section className="settings-section">
            <strong>Basic</strong>
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
                className="textarea-compact"
                value={selectedNode.data.description}
                onChange={(event) => onUpdateSelectedNode('description', event.target.value)}
              />
            </label>
          </section>

          {(selectedNode.data.kind === 'condition' || selectedNode.data.kind === 'ai_task') && (
            <section className="settings-section">
              <strong>Logic</strong>
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
                  className="textarea-compact"
                  value={selectedNode.data.decisionRules}
                  onChange={(event) => onUpdateSelectedNode('decisionRules', event.target.value)}
                  placeholder="條件節點用：什麼情況走是？什麼情況走否？"
                />
              </label>
            </section>
          )}

          {selectedNode.data.kind === 'condition' && (
            <section className="branch-editor" aria-label="條件分支編輯">
              <div className="branch-editor-title">
                <strong>Branches</strong>
                <button type="button" onClick={onAddBranch}>
                  <Plus size={14} />
                  新增
                </button>
              </div>
              {branchHandles.map((handle) => (
                <label className="branch-row" key={handle.id}>
                  <span>{handle.id}</span>
                  <input
                    value={handle.label}
                    onChange={(event) => onRenameBranch(handle.id, event.target.value)}
                    placeholder="分支標籤"
                  />
                  <button type="button" onClick={() => onRemoveBranch(handle.id)} disabled={branchHandles.length <= 1}>
                    <Trash2 size={14} />
                    移除
                  </button>
                </label>
              ))}
            </section>
          )}

          <details className="settings-section advanced-section">
            <summary>Advanced</summary>
            <label>
              <span>目的</span>
              <textarea
                value={selectedNode.data.purpose}
                onChange={(event) => onUpdateSelectedNode('purpose', event.target.value)}
                placeholder="這一步為什麼存在？它要幫後續流程解決什麼問題？"
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
          </details>
        </form>
      ) : (
        <div className="empty-settings">
          <strong>選一個節點開始編輯</strong>
          <span>畫布保持乾淨；細節會在這裡出現。</span>
        </div>
      )}
    </aside>
  )
}
