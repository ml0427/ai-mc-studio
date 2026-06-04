import { Handle, Position, type NodeProps } from '@xyflow/react'

import { defaultConditionBranchHandles, nodeTypeLabels } from '../workflow/templates'
import type { WorkflowNode } from '../workflow/types'

export function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowNode>) {
  if (data.kind === 'condition') {
    const branchHandles = data.branchHandles?.length
      ? data.branchHandles
      : defaultConditionBranchHandles

    return (
      <article className={`workflow-node type-${data.kind} split-branch ${selected ? 'selected' : ''}`}>
        <Handle id="top" type="target" position={Position.Top} />
        <>
          {branchHandles.map((handle, index) => (
            <Handle
              id={handle.id}
              key={handle.id}
              type="source"
              position={Position.Bottom}
              style={{ left: `${branchHandleLeft(index, branchHandles.length)}%` }}
            />
          ))}
        </>
        <div className="condition-node-content">
          <span>{nodeTypeLabels[data.kind]}</span>
          <strong>{data.title || '條件分支'}</strong>
        </div>
      </article>
    )
  }

  return (
    <article className={`workflow-node type-${data.kind} ${selected ? 'selected' : ''}`}>
      <Handle id="top" type="target" position={Position.Top} />
      <Handle id="bottom" type="source" position={Position.Bottom} />

      <div className="node-header">
        <span>{nodeTypeLabels[data.kind]}</span>
        <strong>{data.title || '未命名'}</strong>
      </div>
    </article>
  )
}

function branchHandleLeft(index: number, count: number) {
  if (count <= 1) return 50
  if (count === 2) return index === 0 ? 32 : 68
  return ((index + 1) / (count + 1)) * 100
}
