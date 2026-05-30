import { Workflow } from 'lucide-react'

export function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="empty-state">
      <Workflow size={28} />
      <strong>{loading ? '讀取中' : '目前沒有可顯示的流程圖'}</strong>
      <span>選擇專案和流程後會在這裡顯示。</span>
    </div>
  )
}
