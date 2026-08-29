import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';

export const DeletableEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [isHovered, setIsHovered] = useState(false);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const theme = useWorkflowStore((s) => s.theme);

  const isDark = theme === 'dark';
  const defaultStroke = isDark ? '#475569' : '#94A3B8';

  const mergedStyle: React.CSSProperties = {
    stroke: defaultStroke,
    strokeWidth: 2,
    ...style,
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteEdge(id);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={mergedStyle}
        interactionWidth={20}
      />
      {/* Invisible wider interaction stroke to capture hover easily */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={24}
        className="cursor-pointer pointer-events-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan z-30"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {(isHovered || selected) && (
            <button
              onClick={handleDelete}
              title="切断连线 (Delete Connection)"
              className="w-5 h-5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/25 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 flex items-center justify-center shadow-md dark:shadow-xl transition-all transform hover:scale-125 active:scale-95 group animate-in fade-in zoom-in duration-150"
            >
              <X className="w-3 h-3 group-hover:stroke-[2.5]" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default DeletableEdge;
