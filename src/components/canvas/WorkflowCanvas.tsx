import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Node,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '../nodes';
import { DeletableEdge } from './DeletableEdge';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import type { WorkflowNode, WorkflowEdge } from '../../engine/types.ts';

export const WorkflowCanvas: React.FC = () => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);

  const edgeTypes = useMemo(
    () => ({
      default: DeletableEdge,
      deletable: DeletableEdge,
    }),
    []
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  // Node color helper for MiniMap
  const nodeColor = useCallback((node: Node) => {
    switch (node.type) {
      case 'input':
        return '#10B981';
      case 'prompt':
        return '#A855F7';
      case 'llm':
        return '#0284C7';
      case 'code':
        return '#F59E0B';
      case 'output':
        return '#EC4899';
      default:
        return '#64748B';
    }
  }, []);

  return (
    <div className="w-full h-full relative bg-[#0B0F17]">
      <ReactFlow<WorkflowNode, WorkflowEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange<WorkflowNode>}
        onEdgesChange={onEdgesChange as OnEdgesChange<WorkflowEdge>}
        onConnect={onConnect as OnConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        snapToGrid={true}
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'default',
          animated: false,
          style: { stroke: '#475569', strokeWidth: 2 },
        }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1.2}
          color="#334155"
        />
        <Controls className="!bg-slate-900 !border !border-slate-800 !rounded-lg !shadow-xl" />
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={2}
          zoomable
          pannable
          className="!bg-slate-950/90 !border !border-slate-800 !rounded-xl !shadow-2xl"
          maskColor="rgba(11, 15, 23, 0.75)"
        />
      </ReactFlow>
    </div>
  );
};

export default WorkflowCanvas;
