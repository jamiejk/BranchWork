import dagre from "@dagrejs/dagre";
import type { NodeId, Position, ResearchEdge, ResearchNode } from "@branchwork/domain";
import { ANCESTRY_EDGE_TYPE, descendantIds } from "./traversal";
import type { GraphSnapshot } from "./traversal";

export type LayoutScope =
  | { kind: "subtree"; rootIds: NodeId[] }
  | { kind: "selection"; nodeIds: NodeId[] };

export interface LayoutOptions {
  direction?: "TB" | "LR";
  levelSeparation?: number;
  siblingSeparation?: number;
  defaultWidth?: number;
  defaultHeight?: number;
}

export interface LayoutResult {
  positions: Map<NodeId, Position>;
  movedNodeIds: NodeId[];
}

const DEFAULTS = {
  direction: "TB" as const,
  levelSeparation: 90,
  siblingSeparation: 60,
  defaultWidth: 260,
  defaultHeight: 120,
};

export function computeLayout(
  graph: GraphSnapshot,
  scope: LayoutScope,
  options: LayoutOptions = {}
): LayoutResult {
  const opts = { ...DEFAULTS, ...options };
  const nodeById = new Map<NodeId, ResearchNode>(graph.nodes.map((n) => [n.id, n]));

  let scopeIds: NodeId[];
  if (scope.kind === "subtree") {
    scopeIds = [
      ...new Set([
        ...scope.rootIds.filter((id) => nodeById.has(id)),
        ...descendantIds(graph.edges, scope.rootIds),
      ]),
    ];
  } else {
    scopeIds = [...new Set(scope.nodeIds.filter((id) => nodeById.has(id)))];
  }
  const scopeSet = new Set(scopeIds);

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: opts.direction, nodesep: opts.siblingSeparation, ranksep: opts.levelSeparation });
  g.setDefaultEdgeLabel(() => ({}));

  for (const id of scopeIds) {
    const node = nodeById.get(id);
    if (!node) continue;
    g.setNode(id, {
      width: node.size?.width ?? opts.defaultWidth,
      height: node.size?.height ?? opts.defaultHeight,
    });
  }

  for (const edge of graph.edges) {
    if (!scopeSet.has(edge.sourceNodeId) || !scopeSet.has(edge.targetNodeId)) continue;
    if (edge.type !== ANCESTRY_EDGE_TYPE && scope.kind === "subtree") continue;
    try {
      g.setEdge(edge.sourceNodeId, edge.targetNodeId);
    } catch {
      // dagre throws on edges referencing unknown nodes; scope filtering prevents this
    }
  }

  dagre.layout(g);

  const positions = new Map<NodeId, Position>();
  const movedNodeIds: NodeId[] = [];
  for (const id of scopeIds) {
    const laidOut = g.node(id) as { x: number; y: number; width: number; height: number } | undefined;
    const original = nodeById.get(id);
    if (!laidOut || !original) continue;
    const position = { x: laidOut.x - laidOut.width / 2, y: laidOut.y - laidOut.height / 2 };
    positions.set(id, position);
    if (
      Math.abs(original.position.x - position.x) > 0.5 ||
      Math.abs(original.position.y - position.y) > 0.5
    ) {
      movedNodeIds.push(id);
    }
  }

  return { positions, movedNodeIds };
}

export function suggestChildPosition(
  parent: ResearchNode,
  existingChildren: ResearchNode[]
): Position {
  const childWidth = parent.size?.width ?? DEFAULTS.defaultWidth;
  const childHeight = parent.size?.height ?? DEFAULTS.defaultHeight;
  const verticalGap = 24;
  const offsetX = childWidth + 80;
  const slot = existingChildren.length;
  return {
    x: parent.position.x + offsetX,
    y: parent.position.y + slot * (childHeight + verticalGap),
  };
}

export function countAncestryEdges(edges: ResearchEdge[]): number {
  return edges.filter((e) => e.type === ANCESTRY_EDGE_TYPE).length;
}
