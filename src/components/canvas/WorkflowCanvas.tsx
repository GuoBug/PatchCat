import React, { useCallback, useMemo, useEffect } from 'react';
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
  useReactFlow,
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

  const centerTargetNodeId = useWorkflowStore((s) => s.centerTargetNodeId);
  const clearCenterTarget = useWorkflowStore((s) => s.clearCenterTarget);
  const captureSnapshot = useWorkflowStore((s) => s.captureSnapshot);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const copySelectedNodes = useWorkflowStore((s) => s.copySelectedNodes);
  const pasteNodes = useWorkflowStore((s) => s.pasteNodes);

  const { setCenter, getNode } = useReactFlow();

  // Smoothly center and focus on target node (e.g. from error diagnostics)
  useEffect(() => {
    if (centerTargetNodeId) {
      const target = getNode(centerTargetNodeId);
      if (target) {
        setCenter(target.position.x + 140, target.position.y + 100, {
          zoom: 1.1,
          duration: 600,
        });
      }
      clearCenterTarget();
    }
  }, [centerTargetNodeId, getNode, setCenter, clearCenterTarget]);

  // Global canvas keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is typing in form controls
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.monaco-editor'))
      ) {
        return;
      }

      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier) return;

      const key = e.key.toLowerCase();

      // Ctrl+Z (Undo) / Ctrl+Shift+Z (Redo)
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (key === 'y') {
        // Ctrl+Y (Redo)
        e.preventDefault();
        redo();
      } else if (key === 'c') {
        // Ctrl+C (Copy Selected Nodes)
        copySelectedNodes();
      } else if (key === 'v') {
        // Ctrl+V (Paste Nodes)
        e.preventDefault();
        pasteNodes();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copySelectedNodes, pasteNodes]);

  const edgeTypes = useMemo(
    () => ({
      default: DeletableEdge,
      deletable: DeletableEdge,
    }),
    [],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      useWorkflowStore.getState().setPropertyPanelOpen(false);
    }
  }, [setSelectedNodeId]);

  // Node color helper for MiniMap (all 12 node types)
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
      case 'knowledge':
        return '#06B6D4';
      case 'condition':
        return '#F97316';
      case 'aggregator':
        return '#A855F7';
      case 'http':
        return '#14B8A6';
      case 'agent':
        return '#6366F1';
      case 'loop':
        return '#0EA5E9';
      case 'sub_workflow':
        return '#EC4899';
      default:
        return '#64748B';
    }
  }, []);

  const isDark = theme === 'dark';

  return (
    <div
      className={`w-full h-full relative transition-colors duration-200 ${isDark ? 'bg-[#0B0F17]' : 'bg-slate-50'}`}
    >
      <ReactFlow<WorkflowNode, WorkflowEdge>
        style={{ backgroundColor: isDark ? '#0B0F17' : '#F8FAFC' }}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange as OnNodesChange<WorkflowNode>}
        onEdgesChange={onEdgesChange as OnEdgesChange<WorkflowEdge>}
        onConnect={onConnect as OnConnect}
        onNodeDragStop={() => captureSnapshot()}
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
          bgColor={isDark ? '#0B0F17' : '#F8FAFC'}
          gap={isDark ? 18 : 20}
          size={isDark ? 1.2 : 1.25}
          color={isDark ? '#334155' : '#CBD5E1'}
        />
        <Controls
          className={
            isDark
              ? '!bg-slate-900 !border-slate-800 !shadow-xl'
              : '!bg-white !border-slate-200 !shadow-sm'
          }
        />
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={2}
          zoomable
          pannable
          className={
            isDark
              ? '!bg-slate-950/90 !border-slate-800 !rounded-xl !shadow-2xl'
              : '!bg-white/95 !border-slate-200 !rounded-xl !shadow-md'
          }
          maskColor={isDark ? 'rgba(11, 15, 23, 0.75)' : 'rgba(248, 250, 252, 0.75)'}
        />
      </ReactFlow>
    </div>
  );
};

export default WorkflowCanvas;
