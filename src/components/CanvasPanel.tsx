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
import { Copy, Redo2, RotateCcw, Route, Trash2, Undo2 } from 'lucide-react'

import { defaultEdgeOptions } from '../workflow/edges'
import { nodeColor } from '../workflow/templates'
import type { ThemeMode, WorkflowEdge, WorkflowNode } from '../workflow/types'
import { WorkflowNodeCard } from './WorkflowNodeCard'

const nodeTypes: NodeTypes = { workflowNode: WorkflowNodeCard }

type CanvasPanelProps = {
  canDelete: boolean
  canDuplicate: boolean
  canRedo: boolean
  canUndo: boolean
  edges: WorkflowEdge[]
  nodes: WorkflowNode[]
  selectedEdgeId: string
  selectedNodeId: string
  themeMode: ThemeMode
  onAutoLayout: () => void
  onClearCanvas: () => void
  onConnect: OnConnect
  onDeleteSelected: () => void
  onDuplicateSelected: () => void
  onEdgeSelect: (edgeId: string) => void
  onEdgesChange: OnEdgesChange<WorkflowEdge>
  onFitView: () => void
  onNodesChange: OnNodesChange<WorkflowNode>
  onNodeSelect: (nodeId: string) => void
  onPaneClick: () => void
  onReconnect: OnReconnect<WorkflowEdge>
  onRedo: () => void
  onRestoreInitialCanvas: () => void
  onUndo: () => void
}

export function CanvasPanel({
  canDelete,
  canDuplicate,
  canRedo,
  canUndo,
  edges,
  nodes,
  selectedEdgeId,
  selectedNodeId,
  themeMode,
  onAutoLayout,
  onClearCanvas,
  onConnect,
  onDeleteSelected,
  onDuplicateSelected,
  onEdgeSelect,
  onEdgesChange,
  onFitView,
  onNodesChange,
  onNodeSelect,
  onPaneClick,
  onReconnect,
  onRedo,
  onRestoreInitialCanvas,
  onUndo,
}: CanvasPanelProps) {
  const visibleNodes = nodes.map((node) => ({
    ...node,
    selected: node.id === selectedNodeId,
  }))
  const visibleEdges = edges.map((edge) => ({
    ...edge,
    selected: edge.id === selectedEdgeId,
    animated: edge.id === selectedEdgeId ? true : edge.animated,
  }))

  return (
    <section className="canvas-panel" aria-label="流程圖畫布">
      <div className="canvas-actions">
        <button type="button" onClick={onAutoLayout}>
          <Route size={15} />
          自動整理
        </button>
        <button type="button" onClick={onFitView}>
          <Route size={15} />
          適合畫面
        </button>
        <button type="button" onClick={onDuplicateSelected} disabled={!canDuplicate}>
          <Copy size={15} />
          複製
        </button>
        <button type="button" onClick={onDeleteSelected} disabled={!canDelete}>
          <Trash2 size={15} />
          刪除
        </button>
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          <Undo2 size={15} />
          復原
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>
          <Redo2 size={15} />
          重做
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
        edges={visibleEdges}
        edgesReconnectable
        fitView
        nodes={visibleNodes}
        nodeTypes={nodeTypes}
        reconnectRadius={10}
        onConnect={onConnect}
        onEdgeClick={(_, edge) => onEdgeSelect(edge.id)}
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
