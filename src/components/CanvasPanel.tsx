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
import { Copy, Maximize2, MoreHorizontal, Redo2, RotateCcw, Route, Trash2, Undo2 } from 'lucide-react'

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
      <div className="canvas-actions" aria-label="畫布操作">
        <div className="canvas-action-group" aria-label="歷史">
          <button type="button" onClick={onUndo} disabled={!canUndo} title="復原">
            <Undo2 size={15} />
            <span>復原</span>
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} title="重做">
            <Redo2 size={15} />
            <span>重做</span>
          </button>
        </div>
        <div className="canvas-action-group" aria-label="視圖">
          <button type="button" onClick={onFitView} title="適合畫面">
            <Maximize2 size={15} />
            <span>適合</span>
          </button>
          <button type="button" onClick={onAutoLayout} title="自動整理">
            <Route size={15} />
            <span>整理</span>
          </button>
        </div>
        <div className="canvas-action-group" aria-label="選取項目">
          <button type="button" onClick={onDuplicateSelected} disabled={!canDuplicate} title="複製選取節點">
            <Copy size={15} />
            <span>複製</span>
          </button>
          <button type="button" onClick={onDeleteSelected} disabled={!canDelete} title="刪除選取項目">
            <Trash2 size={15} />
            <span>刪除</span>
          </button>
        </div>
        <div className="canvas-action-group canvas-action-group-secondary" aria-label="更多">
          <MoreHorizontal size={15} aria-hidden="true" />
          <button type="button" onClick={onRestoreInitialCanvas} title="還原初始畫布">
            <RotateCcw size={15} />
            <span>初始</span>
          </button>
          <button type="button" onClick={onClearCanvas} title="清空畫布">
            <Trash2 size={15} />
            <span>清空</span>
          </button>
        </div>
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
        <Background color={themeMode === 'dark' ? '#293241' : '#d7dde8'} gap={28} />
        <Controls position="top-right" />
        <MiniMap
          maskColor={themeMode === 'dark' ? 'rgba(8, 11, 18, 0.72)' : 'rgba(248, 250, 252, 0.68)'}
          nodeColor={(node) => nodeColor((node as WorkflowNode).data.kind)}
          pannable
          zoomable
        />
      </ReactFlow>
    </section>
  )
}
