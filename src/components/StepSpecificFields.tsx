import { commandOptionLabel } from '../lib/format'
import type { WorkflowDefinition, WorkflowStep } from '../types/workflow'

export function StepSpecificFields({
  step,
  workflow,
  onPatchStep,
}: {
  step: WorkflowStep
  workflow?: WorkflowDefinition | null
  onPatchStep: (updater: (step: WorkflowStep) => void) => void
}) {
  const commandText = step.commands?.join('\n') ?? ''
  const commandOptions = Object.entries(workflow?.evidence?.commands ?? {})

  return (
    <div className="step-specific-fields">
      {(step.type === 'shell' || step.type === 'tool-or-shell') && (
        <label>
          <span>要跑的指令</span>
          <textarea
            value={commandText}
            onChange={(event) => onPatchStep((draft) => {
              const commands = event.target.value
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
              if (commands.length > 0) draft.commands = commands
              else delete draft.commands
            })}
            placeholder="npm run build"
          />
        </label>
      )}
      {(step.type === 'ai' || step.type === 'tool-or-code-edit') && (
        <>
          <div className="field-help">
            AI 要做的內容由積木名稱、輸入和輸出格式決定；這裡只設定能不能交給小幫手。
          </div>
          <label>
            <span>低判斷小幫手</span>
            <select
              value={step.delegate ?? 'not-delegable'}
              onChange={(event) => onPatchStep((draft) => {
                if (event.target.value === 'allowed') draft.delegate = 'allowed'
                else delete draft.delegate
              })}
            >
              <option value="not-delegable">主 AI 自己做</option>
              <option value="allowed">可以交給小幫手</option>
            </select>
          </label>
          <label>
            <span>小幫手任務類型</span>
            <input
              value={step.task_class ?? ''}
              onChange={(event) => onPatchStep((draft) => {
                const value = event.target.value.trim()
                if (value) draft.task_class = value
                else delete draft.task_class
              })}
              placeholder="diff_summary"
            />
          </label>
        </>
      )}
      {step.type !== 'ai' && (
        commandOptions.length > 0 ? (
          <label>
            <span>已存在的指令代號</span>
            <select
              value={step.command_ref ?? ''}
              onChange={(event) => onPatchStep((draft) => {
                if (event.target.value) draft.command_ref = event.target.value
                else delete draft.command_ref
              })}
            >
              <option value="">不指定</option>
              {commandOptions.map(([name, value]) => (
                <option value={name} key={name}>{commandOptionLabel(name, value)}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>已存在的指令代號</span>
            <input
              value={step.command_ref ?? ''}
              onChange={(event) => onPatchStep((draft) => {
                const value = event.target.value.trim()
                if (value) draft.command_ref = value
                else delete draft.command_ref
              })}
              placeholder="git_status"
            />
          </label>
        )
      )}
      <label className="inline-check">
        <input
          type="checkbox"
          checked={Boolean(step.blocks_downstream)}
          onChange={(event) => onPatchStep((draft) => {
            if (event.target.checked) draft.blocks_downstream = true
            else delete draft.blocks_downstream
          })}
        />
        <span>這塊沒完成時，先不要跑後面的積木</span>
      </label>
    </div>
  )
}
