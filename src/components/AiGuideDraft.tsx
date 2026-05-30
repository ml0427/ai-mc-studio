import { useMemo, useState } from 'react'
import { ClipboardCheck, Sparkles } from 'lucide-react'
import { STEP_TEMPLATES, stepTypeMeta } from '../data/stepTemplates'
import type { StepTemplate, WorkflowStep } from '../types/workflow'

export function AiGuideDraft({
  steps,
  onAddStep,
}: {
  steps: WorkflowStep[]
  onAddStep: (template: StepTemplate, options?: { afterStepId?: string; when?: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [afterStepId, setAfterStepId] = useState('__entry__')
  const [templateType, setTemplateType] = useState(STEP_TEMPLATES[0]?.type ?? 'ai')
  const [intent, setIntent] = useState('整理下一步要做什麼')
  const [draftReady, setDraftReady] = useState(false)
  const selectedTemplate = useMemo(
    () => STEP_TEMPLATES.find((template) => template.type === templateType) ?? STEP_TEMPLATES[0],
    [templateType],
  )

  function applyDraft() {
    if (!selectedTemplate) return
    onAddStep(selectedTemplate, { afterStepId, when: intent.trim() || undefined })
    setDraftReady(false)
    setOpen(false)
  }

  return (
    <div className="ai-guide-draft">
      <button className="ai-guide-toggle" type="button" onClick={() => setOpen((current) => !current)}>
        <Sparkles size={16} />
        AI 司儀幫我加方塊
      </button>
      {open && (
        <div className="ai-guide-card">
          <div className="ai-guide-title">
            <Sparkles size={16} />
            <span>
              <strong>先做草稿，不直接亂改</strong>
              <small>回答三件事，我幫你準備一塊新方塊。</small>
            </span>
          </div>
          <label>
            <span>要放在哪裡後面</span>
            <select value={afterStepId} onChange={(event) => setAfterStepId(event.target.value)}>
              <option value="__entry__">入口後面</option>
              {steps.map((step) => (
                <option key={step.id} value={step.id}>{step.id}</option>
              ))}
            </select>
          </label>
          <label>
            <span>這塊要做什麼</span>
            <select value={templateType} onChange={(event) => setTemplateType(event.target.value)}>
              {STEP_TEMPLATES.map((template) => (
                <option key={template.type} value={template.type}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>一句話說明</span>
            <input value={intent} onChange={(event) => setIntent(event.target.value)} />
          </label>
          <button className="draft-preview-button" type="button" onClick={() => setDraftReady(true)}>
            <ClipboardCheck size={14} />
            產生草稿
          </button>
          {draftReady && selectedTemplate && (
            <div className="draft-preview">
              <strong>{stepTypeMeta(selectedTemplate.type).label}</strong>
              <span>{intent || selectedTemplate.hint}</span>
              <small>確認後會加入流程，這才會讓 workflow 變成尚未儲存。</small>
              <button type="button" onClick={applyDraft}>確認加入畫布</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
