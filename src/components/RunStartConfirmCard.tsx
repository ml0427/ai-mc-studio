import { AlertTriangle, CheckCircle2, Play, X } from 'lucide-react'

export function RunStartConfirmCard({
  missingInputs,
  outputs,
  stepCount,
  onCancel,
  onConfirm,
}: {
  missingInputs: string[]
  outputs: string[]
  stepCount: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const canStart = missingInputs.length === 0
  const visibleOutputs = outputs.slice(0, 5)
  const hiddenOutputCount = Math.max(outputs.length - visibleOutputs.length, 0)

  return (
    <div className={`run-confirm-card ${canStart ? 'ready' : 'blocked'}`}>
      <div className="run-confirm-title">
        {canStart ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        <span>
          <strong>{canStart ? '準備開始' : '還不能開始'}</strong>
          <small>
            {canStart
              ? `這次會照順序跑 ${stepCount} 塊積木。`
              : `先補這些資料：${missingInputs.join('、')}`}
          </small>
        </span>
      </div>

      {canStart ? (
        <div className="run-confirm-body">
          <p>需要的資料都填好了。</p>
          <div>
            <span>可能會做出</span>
            {visibleOutputs.length > 0 ? (
              <div className="run-confirm-pills">
                {visibleOutputs.map((output) => <small key={output}>{output}</small>)}
                {hiddenOutputCount > 0 && <small>還有 {hiddenOutputCount} 個</small>}
              </div>
            ) : (
              <p>這條流程沒有寫明成果名稱，但仍會依照積木設定執行。</p>
            )}
          </div>
        </div>
      ) : (
        <div className="run-confirm-body">
          <p>補完後再按「開始前檢查」。</p>
        </div>
      )}

      <div className="run-confirm-actions">
        {canStart && (
          <button className="confirm-start-button" type="button" onClick={onConfirm}>
            <Play size={14} />
            確認開始
          </button>
        )}
        <button className="check-again-button" type="button" onClick={onCancel}>
          <X size={14} />
          再檢查一下
        </button>
      </div>
    </div>
  )
}
