import { useState, type ChangeEvent, type RefObject } from 'react'
import { FileInput, Moon, Plus, Route, Sun, Upload, X } from 'lucide-react'

import { localizeWorkflowTerm } from '../workflow/localization'
import type { ThemeMode, WorkflowNodeKind } from '../workflow/types'
import { NodePalette } from './NodePalette'

type RailPanel = 'nodes' | 'import' | null

type ToolboxPanelProps = {
  fileInputRef: RefObject<HTMLInputElement | null>
  importMessage: string
  importText: string
  importWorkflowNames: string[]
  selectedImportWorkflow: string
  showImportPanel: boolean
  themeMode: ThemeMode
  onAddNode: (kind: WorkflowNodeKind) => void
  onImportAiMcWorkflow: () => void
  onImportCanvasBackup: () => void
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onImportTextChange: (value: string) => void
  onSelectImportWorkflow: (workflowName: string) => void
  onToggleImportPanel: () => void
  onToggleTheme: () => void
  onUseSampleImport: () => void
}

export function ToolboxPanel({
  fileInputRef,
  importMessage,
  importText,
  importWorkflowNames,
  selectedImportWorkflow,
  showImportPanel,
  themeMode,
  onAddNode,
  onImportAiMcWorkflow,
  onImportCanvasBackup,
  onImportFileChange,
  onImportTextChange,
  onSelectImportWorkflow,
  onToggleImportPanel,
  onToggleTheme,
  onUseSampleImport,
}: ToolboxPanelProps) {
  const [activePanel, setActivePanel] = useState<RailPanel>('nodes')
  const resolvedPanel = showImportPanel ? 'import' : activePanel

  function openPanel(panel: Exclude<RailPanel, null>) {
    setActivePanel(panel)
    if (panel === 'import' && !showImportPanel) onToggleImportPanel()
    if (panel === 'nodes' && showImportPanel) onToggleImportPanel()
  }

  function closePanel() {
    if (showImportPanel) onToggleImportPanel()
    setActivePanel(null)
  }

  return (
    <aside className={`toolbox-panel ${resolvedPanel ? 'is-open' : ''}`} aria-label="節點工具箱">
      <div className="rail-strip" aria-label="工作區工具">
        <div className="rail-logo" title="AI-MC Studio">
          <Route size={18} />
        </div>
        <button className={resolvedPanel === 'nodes' ? 'active' : ''} type="button" onClick={() => openPanel('nodes')} title="新增節點">
          <Plus size={17} />
          <span>新增</span>
        </button>
        <button className={resolvedPanel === 'import' ? 'active' : ''} type="button" onClick={() => openPanel('import')} title="匯入 YAML">
          <FileInput size={17} />
          <span>匯入</span>
        </button>
        <button type="button" onClick={onToggleTheme} title="切換主題">
          {themeMode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          <span>{themeMode === 'dark' ? '亮色' : '暗色'}</span>
        </button>
      </div>

      {resolvedPanel && (
        <div className="drawer-panel">
          <div className="drawer-title">
            <div>
              <span>{resolvedPanel === 'nodes' ? 'Build' : 'Import'}</span>
              <strong>{resolvedPanel === 'nodes' ? '新增節點' : '匯入 workflow'}</strong>
            </div>
            <button type="button" onClick={closePanel} aria-label="關閉左側 drawer">
              <X size={15} />
            </button>
          </div>

          {resolvedPanel === 'import' ? (
            <section className="import-panel" aria-label="匯入 ai-mc workflow">
              <input
                ref={fileInputRef}
                className="file-input"
                type="file"
                accept=".yaml,.yml,.json,application/json,text/yaml,text/x-yaml"
                onChange={onImportFileChange}
              />
              <textarea
                value={importText}
                onChange={(event) => onImportTextChange(event.target.value)}
                placeholder="貼上 workflow.yaml 或 JSON"
                spellCheck={false}
              />
              {importWorkflowNames.length > 1 && (
                <label className="workflow-picker">
                  <span>路線</span>
                  <select
                    value={selectedImportWorkflow}
                    onChange={(event) => onSelectImportWorkflow(event.target.value)}
                  >
                    {importWorkflowNames.map((name) => (
                      <option key={name} value={name}>{localizeWorkflowTerm(name)}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="import-actions">
                <button type="button" onClick={() => fileInputRef.current?.click()}>選檔案</button>
                <button type="button" onClick={onUseSampleImport}>範例</button>
                <button type="button" onClick={onImportAiMcWorkflow} disabled={!importText.trim()}>匯入</button>
                <button type="button" onClick={onImportCanvasBackup} disabled={!importText.trim()}>
                  <Upload size={14} />
                  備份
                </button>
              </div>
              {importMessage && <p>{importMessage}</p>}
            </section>
          ) : (
            <NodePalette onAddNode={(kind) => {
              onAddNode(kind)
              setActivePanel(null)
            }} />
          )}
        </div>
      )}
    </aside>
  )
}
