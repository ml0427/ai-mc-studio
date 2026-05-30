import { useEffect, useMemo, useState } from 'react'
import {
  defaultFlowLayout,
  FLOW_LAYOUT_VERSION,
  mergeLayoutWithSteps,
  type FlowCanvasLayout,
} from '../lib/flowLayout'
import type { WorkflowStep } from '../types/workflow'

function emptyLayout(): FlowCanvasLayout {
  return { version: FLOW_LAYOUT_VERSION, nodes: {} }
}

export function useFlowCanvasLayout({
  projectId,
  workflowName,
  steps,
}: {
  projectId?: string
  workflowName: string
  steps: WorkflowStep[]
}) {
  const storageKey = useMemo(() => (
    projectId && workflowName
      ? `ai-mc-studio:canvas-layout:${projectId}:${workflowName}`
      : ''
  ), [projectId, workflowName])
  const [storedLayout, setStoredLayout] = useState<FlowCanvasLayout>(() => {
    if (!storageKey) {
      return emptyLayout()
    }

    try {
      const stored = window.localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) as FlowCanvasLayout : emptyLayout()
    } catch {
      return emptyLayout()
    }
  })
  const layout = useMemo(
    () => mergeLayoutWithSteps(storedLayout, steps),
    [steps, storedLayout],
  )

  useEffect(() => {
    if (!storageKey) return
    window.localStorage.setItem(storageKey, JSON.stringify(layout))
  }, [layout, storageKey])

  function setNodePosition(stepId: string, x: number, y: number) {
    setStoredLayout((current) => ({
      version: FLOW_LAYOUT_VERSION,
      nodes: {
        ...current.nodes,
        [stepId]: {
          ...current.nodes[stepId],
          x: Math.max(24, x),
          y: Math.max(24, y),
        },
      },
    }))
  }

  function toggleCollapsed(stepId: string) {
    setStoredLayout((current) => ({
      version: FLOW_LAYOUT_VERSION,
      nodes: {
        ...current.nodes,
        [stepId]: {
          ...current.nodes[stepId],
          collapsed: !current.nodes[stepId]?.collapsed,
        },
      },
    }))
  }

  function formatCanvas() {
    setStoredLayout(defaultFlowLayout(steps))
  }

  return {
    layout,
    formatCanvas,
    setNodePosition,
    toggleCollapsed,
  }
}
