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
  const theme = useWorkflowStore((s) => s.theme);

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
        return '#8B5CF6';
      case 'llm':
        return '#3B82F6';
      case 'code':
        return '#F59E0B';
      case 'output':
        return '#F43F5E';
      default:
        return '#64748B';
    }
  }, []);

  const isDark = theme === 'dark';

  return (
    <div className={`w-full h-full relative transition-colors duration-200 ${isDark ? 'bg-[#0B0F17]' : 'bg-slate-50'}`}>
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
          style: { stroke: isDark ? '#475569' : '#CBD5E1', strokeWidth: 2 },
        }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={isDark ? 18 : 20}
          size={isDark ? 1.2 : 1.25}
          color={isDark ? '#334155' : '#CBD5E1'}
        />
        <Controls className={isDark ? '!bg-slate-900 !border-slate-800 !shadow-xl' : '!bg-white !border-slate-200 !shadow-sm'} />
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={2}
          zoomable
          pannable
          className={isDark ? '!bg-slate-950/90 !border-slate-800 !rounded-xl !shadow-2xl' : '!bg-white/95 !border-slate-200 !rounded-xl !shadow-md'}
          maskColor={isDark ? 'rgba(11, 15, 23, 0.75)' : 'rgba(248, 250, 252, 0.75)'}
        />
      </ReactFlow>
    </div>
  );
};

export default WorkflowCanvas;
