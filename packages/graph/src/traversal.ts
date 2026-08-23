import type { EdgeType, NodeId, ResearchEdge, ResearchNode } from "@branchwork/domain";

export interface GraphSnapshot {
  nodes: ResearchNode[];
  edges: ResearchEdge[];
}

export const ANCESTRY_EDGE_TYPE: EdgeType = "branches_from";

export function buildChildMap(edges: ResearchEdge[]): Map<NodeId, NodeId[]> {
  const map = new Map<NodeId, NodeId[]>();
  for (const edge of edges) {
    if (edge.type !== ANCESTRY_EDGE_TYPE) continue;
    const list = map.get(edge.sourceNodeId);
    if (list) {
      if (!list.includes(edge.targetNodeId)) list.push(edge.targetNodeId);
    } else {
      map.set(edge.sourceNodeId, [edge.targetNodeId]);
    }
  }
  return map;
}

export function buildParentMap(edges: ResearchEdge[]): Map<NodeId, NodeId> {
  const map = new Map<NodeId, NodeId>();
  for (const edge of edges) {
    if (edge.type !== ANCESTRY_EDGE_TYPE) continue;
    if (!map.has(edge.targetNodeId)) {
      map.set(edge.targetNodeId, edge.sourceNodeId);
    }
  }
  return map;
}

export function childrenOf(edges: ResearchEdge[], nodeId: NodeId): NodeId[] {
  return buildChildMap(edges).get(nodeId) ?? [];
}

export function parentOf(edges: ResearchEdge[], nodeId: NodeId): NodeId | undefined {
  return buildParentMap(edges).get(nodeId);
}

export function ancestorsOf(edges: ResearchEdge[], nodeId: NodeId): NodeId[] {
  const parents = buildParentMap(edges);
  const result: NodeId[] = [];
  let current = parents.get(nodeId);
  while (current !== undefined) {
    result.push(current);
    current = parents.get(current);
  }
  return result;
}

export function descendantIds(
  edges: ResearchEdge[],
  rootIds: NodeId[],
  options: { stopAt?: Set<NodeId>; includeRoots?: boolean } = {}
): NodeId[] {
  const childMap = buildChildMap(edges);
  const visited = new Set<NodeId>();
  const queue = [...rootIds];
  const out: NodeId[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as NodeId;
    if (visited.has(id)) continue;
    visited.add(id);
    if (options.stopAt?.has(id)) continue;
    if (options.includeRoots || !rootIds.includes(id)) out.push(id);
    for (const child of childMap.get(id) ?? []) {
      if (!visited.has(child)) queue.push(child);
    }
  }
  return out;
}

export function wouldCreateAncestryCycle(
  edges: ResearchEdge[],
  parentId: NodeId,
  childId: NodeId
): boolean {
  if (parentId === childId) return true;
  return ancestorsOf(edges, parentId).includes(childId);
}

export function hasAncestryEdge(
  edges: ResearchEdge[],
  parentId: NodeId,
  childId: NodeId
): boolean {
  return edges.some(
    (e) =>
      e.type === ANCESTRY_EDGE_TYPE &&
      e.sourceNodeId === parentId &&
      e.targetNodeId === childId
  );
}

export function findSemanticEdge(
  edges: ResearchEdge[],
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
  type: EdgeType
): ResearchEdge | undefined {
  return edges.find(
    (e) => e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId && e.type === type
  );
}
