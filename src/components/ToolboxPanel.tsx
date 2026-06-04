import type { ChangeEvent, RefObject } from 'react'
import { FileInput, Moon, Route, Sun, Upload } from 'lucide-react'

import { localizeWorkflowTerm } from '../workflow/localization'
import type { ThemeMode, WorkflowNodeKind } from '../workflow/types'
import { NodePalette } from './NodePalette'

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
  return (
    <aside className="toolbox-panel" aria-label="節點工具箱">
      <div className="brand-block">
        <Route size={18} />
        <div>
          <strong>AI-MC Studio</strong>
          <span>Workflow canvas</span>
        </div>
      </div>

      <div className="toolbox-top-actions">
        <button className="import-toggle" type="button" onClick={onToggleImportPanel}>
          <FileInput size={15} />
          匯入
        </button>
        <button className="theme-toggle" type="button" onClick={onToggleTheme}>
          {themeMode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {themeMode === 'dark' ? '亮色' : '暗色'}
        </button>
      </div>

      {showImportPanel && (
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
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              選檔案
            </button>
            <button type="button" onClick={onUseSampleImport}>
              範例
            </button>
            <button type="button" onClick={onImportAiMcWorkflow} disabled={!importText.trim()}>
              匯入
            </button>
            <button type="button" onClick={onImportCanvasBackup} disabled={!importText.trim()}>
              <Upload size={14} />
              備份
            </button>
          </div>
          {importMessage && <p>{importMessage}</p>}
        </section>
      )}

      <div className="palette-heading">
        <span>新增節點</span>
      </div>
      <NodePalette onAddNode={onAddNode} />
    </aside>
  )
}
