type ConfirmationDialogProps = {
  action: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmationDialog({ action, onCancel, onConfirm }: ConfirmationDialogProps) {
  return (
    <div className="confirm-backdrop" role="presentation">
      <section
        aria-labelledby="confirm-title"
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
      >
        <strong id="confirm-title">確認覆蓋畫布？</strong>
        <p>{action}會覆蓋目前畫布內容。要繼續嗎？</p>
        <div className="confirm-actions">
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button className="danger" type="button" onClick={onConfirm}>
            覆蓋並繼續
          </button>
        </div>
      </section>
    </div>
  )
}
