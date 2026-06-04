import { ChevronDown, ChevronUp, Copy, Download } from 'lucide-react'

import type { PreviewMode } from '../workflow/types'

type PreviewPanelProps = {
  activePreview: string
  edgeCount: number
  nodeCount: number
  previewActionMessage: string
  previewMode: PreviewMode
  showJsonPreview: boolean
  onCopyActivePreview: () => void
  onDownloadPreview: (mode: PreviewMode) => void
  onPreviewModeChange: (mode: PreviewMode) => void
  onToggleJsonPreview: () => void
}

export function PreviewPanel({
  activePreview,
  edgeCount,
  nodeCount,
  previewActionMessage,
  previewMode,
  showJsonPreview,
  onCopyActivePreview,
  onDownloadPreview,
  onPreviewModeChange,
  onToggleJsonPreview,
}: PreviewPanelProps) {
  return (
    <section className="json-panel" aria-label="目前流程資料">
      <div className="json-title">
        <div className="json-summary">
          <strong>Export</strong>
          <span>{nodeCount} nodes / {edgeCount} edges</span>
        </div>
        <div className="preview-controls">
          <label className="preview-mode-select">
            <span>格式</span>
            <select value={previewMode} onChange={(event) => onPreviewModeChange(event.target.value as PreviewMode)}>
              <option value="aiMc">ai-mc JSON</option>
              <option value="graph">graph YAML</option>
              <option value="canvas">canvas JSON</option>
            </select>
          </label>
          <div className="preview-actions" aria-label="預覽操作">
            <button type="button" onClick={onCopyActivePreview}>
              <Copy size={14} />
              複製
            </button>
            <button type="button" onClick={() => onDownloadPreview(previewMode)}>
              <Download size={14} />
              下載
            </button>
          </div>
          <button
            className="json-toggle"
            aria-expanded={showJsonPreview}
            type="button"
            onClick={onToggleJsonPreview}
          >
            {showJsonPreview ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            {showJsonPreview ? '收合' : '展開'}
          </button>
        </div>
      </div>
      {previewActionMessage && (
        <p className="preview-action-message" role="status">
          {previewActionMessage}
        </p>
      )}
      {showJsonPreview && (
        <div className="preview-body">
          <div className="preview-body-title">{previewTitle(previewMode)}</div>
          <pre>{activePreview}</pre>
        </div>
      )}
    </section>
  )
}

function previewTitle(previewMode: PreviewMode) {
  if (previewMode === 'aiMc') return 'ai-mc workflow preview'
  if (previewMode === 'graph') return 'graph YAML preview'
  return 'canvas data preview'
}
