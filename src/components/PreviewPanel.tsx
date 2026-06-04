import { ChevronDown, ChevronUp } from 'lucide-react'

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
        <div>
          <strong>{previewTitle(previewMode)}</strong>
          <span>{nodeCount} 個節點 / {edgeCount} 條線</span>
        </div>
        <div className="preview-controls">
          <div className="preview-mode-tabs" role="tablist" aria-label="預覽格式">
            <button
              aria-selected={previewMode === 'aiMc'}
              role="tab"
              type="button"
              onClick={() => onPreviewModeChange('aiMc')}
            >
              ai-mc 格式
            </button>
            <button
              aria-selected={previewMode === 'graph'}
              role="tab"
              type="button"
              onClick={() => onPreviewModeChange('graph')}
            >
              graph YAML
            </button>
            <button
              aria-selected={previewMode === 'canvas'}
              role="tab"
              type="button"
              onClick={() => onPreviewModeChange('canvas')}
            >
              畫布資料
            </button>
          </div>
          <div className="preview-actions" aria-label="預覽操作">
            <button type="button" onClick={onCopyActivePreview}>
              複製目前預覽
            </button>
            <button type="button" onClick={() => onDownloadPreview('aiMc')}>
              下載 ai-mc JSON
            </button>
            <button type="button" onClick={() => onDownloadPreview('graph')}>
              下載 graph YAML
            </button>
            <button type="button" onClick={() => onDownloadPreview('canvas')}>
              下載畫布 JSON
            </button>
          </div>
          <button
            className="json-toggle"
            aria-expanded={showJsonPreview}
            type="button"
            onClick={onToggleJsonPreview}
          >
            {showJsonPreview ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            {showJsonPreview ? '隱藏下方欄位' : '顯示下方欄位'}
          </button>
        </div>
      </div>
      {previewActionMessage && (
        <p className="preview-action-message" role="status">
          {previewActionMessage}
        </p>
      )}
      {showJsonPreview && <pre>{activePreview}</pre>}
    </section>
  )
}

function previewTitle(previewMode: PreviewMode) {
  if (previewMode === 'aiMc') return 'ai-mc workflow 預覽'
  if (previewMode === 'graph') return 'graph YAML 預覽'
  return '畫布資料'
}
