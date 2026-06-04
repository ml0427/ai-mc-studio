import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type OnReconnect,
} from '@xyflow/react'
import { RotateCcw, Route, Trash2 } from 'lucide-react'

import { defaultEdgeOptions } from '../workflow/edges'
import { nodeColor } from '../workflow/templates'
import type { ThemeMode, WorkflowEdge, WorkflowNode } from '../workflow/types'
import { WorkflowNodeCard } from './WorkflowNodeCard'

const nodeTypes: NodeTypes = { workflowNode: WorkflowNodeCard }

type CanvasPanelProps = {
  edges: WorkflowEdge[]
  nodes: WorkflowNode[]
  themeMode: ThemeMode
  onClearCanvas: () => void
  onConnect: OnConnect
  onEdgesChange: OnEdgesChange<WorkflowEdge>
  onFitView: () => void
  onNodesChange: OnNodesChange<WorkflowNode>
  onNodeSelect: (nodeId: string) => void
  onPaneClick: () => void
  onReconnect: OnReconnect<WorkflowEdge>
  onRestoreInitialCanvas: () => void
}

export function CanvasPanel({
  edges,
  nodes,
  themeMode,
  onClearCanvas,
  onConnect,
  onEdgesChange,
  onFitView,
  onNodesChange,
  onNodeSelect,
  onPaneClick,
  onReconnect,
  onRestoreInitialCanvas,
}: CanvasPanelProps) {
  return (
    <section className="canvas-panel" aria-label="流程圖畫布">
      <div className="canvas-actions">
        <button type="button" onClick={onFitView}>
          <Route size={15} />
          整理畫面
        </button>
        <button type="button" onClick={onRestoreInitialCanvas}>
          <RotateCcw size={15} />
          還原初始
        </button>
        <button type="button" onClick={onClearCanvas}>
          <Trash2 size={15} />
          清空
        </button>
      </div>
      <ReactFlow
        colorMode={themeMode}
        defaultEdgeOptions={defaultEdgeOptions}
        edges={edges}
        edgesReconnectable
        fitView
        nodes={nodes}
        nodeTypes={nodeTypes}
        reconnectRadius={10}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => onNodeSelect(node.id)}
        onPaneClick={onPaneClick}
        onReconnect={onReconnect}
      >
        <Background color={themeMode === 'dark' ? '#273248' : '#cbd5e1'} gap={28} />
        <Controls position="top-right" />
        <MiniMap
          maskColor={themeMode === 'dark' ? 'rgba(7, 10, 18, 0.72)' : 'rgba(226, 232, 240, 0.58)'}
          nodeColor={(node) => nodeColor((node as WorkflowNode).data.kind)}
          pannable
          zoomable
        />
      </ReactFlow>
    </section>
  )
}
