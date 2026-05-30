import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/format'
import { highlightMermaidStep, wireMermaidStepClicks } from '../lib/workflowYaml'
import type { WorkflowStep } from '../types/workflow'

export function MermaidChart({
  chart,
  steps = [],
  selectedStepId,
  onSelectStep,
}: {
  chart: string
  steps?: WorkflowStep[]
  selectedStepId?: string
  onSelectStep?: (stepId: string) => void
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const selectedStepIdRef = useRef(selectedStepId)
  const [error, setError] = useState('')

  useEffect(() => {
    selectedStepIdRef.current = selectedStepId
    if (elementRef.current) highlightMermaidStep(elementRef.current, selectedStepId)
  }, [selectedStepId])

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-${crypto.randomUUID()}`

    async function renderChart() {
      const { default: mermaid } = await import('mermaid')
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: {
          fontFamily: 'Aptos, Segoe UI, sans-serif',
        },
      })
      const { svg } = await mermaid.render(id, chart)
      if (!cancelled && elementRef.current) {
        elementRef.current.innerHTML = svg
        wireMermaidStepClicks(elementRef.current, steps, onSelectStep)
        highlightMermaidStep(elementRef.current, selectedStepIdRef.current)
        setError('')
      }
    }

    renderChart()
      .then(() => {
        // Rendering side effects are handled in renderChart.
      })
      .catch((reason) => {
        if (!cancelled && elementRef.current) {
          elementRef.current.innerHTML = ''
        }
        if (!cancelled) setError(errorMessage(reason))
      })

    return () => {
      cancelled = true
    }
  }, [chart, onSelectStep, steps])

  if (error) {
    return <pre className="yaml-view error-text">{error}</pre>
  }

  return <div className="mermaid-stage" ref={elementRef} />
}
