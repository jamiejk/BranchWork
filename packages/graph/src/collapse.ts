import type { NodeId, ResearchEdge } from "@branchwork/domain";
import { descendantIds } from "./traversal";

export function computeHiddenNodeIds(
  edges: ResearchEdge[],
  collapsedIds: Iterable<NodeId>
): Set<NodeId> {
  const collapsed = new Set(collapsedIds);
  if (collapsed.size === 0) return new Set();
  return new Set(descendantIds(edges, [...collapsed], { includeRoots: false }));
}

export function isEdgeHidden(edge: ResearchEdge, hiddenNodeIds: Set<NodeId>): boolean {
  return hiddenNodeIds.has(edge.sourceNodeId) || hiddenNodeIds.has(edge.targetNodeId);
}
