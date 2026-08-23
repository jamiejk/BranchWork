"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { EDGE_TYPE_LABELS, type EdgeType } from "@branchwork/domain";
import { useStore } from "../../state/store";

export interface BranchEdgeData {
  edgeId: string;
  type: EdgeType;
  label?: string;
  selected: boolean;
}

function BranchEdgeInner({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as unknown as BranchEdgeData;
  const { setCenter } = useReactFlow();
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const type = edgeData?.type ?? "branches_from";
  const selected = edgeData?.selected ?? false;

  return (
    <>
      <BaseEdge
        path={path}
        style={{
          strokeWidth: selected ? 2.4 : 1.4,
          stroke:
            type === "supports"
              ? "#3e7d5a"
              : type === "contradicts"
                ? "#b3564d"
                : type === "cites"
                  ? "#8a6d3b"
                  : "#9aa4b2",
          strokeDasharray: type === "related_to" ? "6 4" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={`bw-edge-label ${selected ? "bw-edge-label-selected" : ""}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => useStore.getState().setSelectedEdge(edgeData.edgeId)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            const state = useStore.getState();
            void setCenter(labelX, labelY, { zoom: 1.1, duration: 300 });
            state.setSelectedEdge(edgeData.edgeId);
          }}
        >
          {edgeData?.label || EDGE_TYPE_LABELS[type]}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const BranchEdge = memo(BranchEdgeInner);
