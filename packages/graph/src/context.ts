import type { EdgeType, NodeId } from "@branchwork/domain";
import { derivePlainText } from "@branchwork/domain";
import { ancestorsOf } from "./traversal";
import type { GraphSnapshot } from "./traversal";
import { estimateTokens, truncateForContext } from "./tokens";

export const CONTEXT_MODES = [
  "local",
  "branch",
  "evidence",
  "selection",
  "retrieval",
  "custom",
] as const;

export type ContextMode = (typeof CONTEXT_MODES)[number];

export interface ContextRequest {
  focalNodeIds: NodeId[];
  mode: ContextMode;
  pinnedNodeIds?: NodeId[];
  excludedNodeIds?: NodeId[];
  includeSources?: boolean;
  tokenBudget?: number;
  query?: string;
}

export type ContextItemRole = "framing" | "focal" | "pinned" | "evidence" | "retrieved";

export interface ContextItem {
  nodeId: NodeId;
  role: ContextItemRole;
  header: string;
  body: string;
}

export interface ContextManifest {
  request: ContextRequest;
  items: ContextItem[];
  includedNodeIds: NodeId[];
  estimatedTokens: number;
  truncated: boolean;
  policy: string;
}

const DEFAULT_TOKEN_BUDGET = 6_000;

const EVIDENCE_EDGE_TYPES: EdgeType[] = ["cites", "supports", "exemplifies", "derived_from"];

function nodeHeader(node: ResearchNodeLike): string {
  return `[NODE ${node.id} | type=${node.type} | author=${node.authorKind}]`;
}

function nodeBody(node: ResearchNodeLike): string {
  const title = node.title.trim();
  const text = node.plainText.trim() || derivePlainText(node.content).trim();
  if (title && text) return `${title}\n${text}`;
  return title || text || "(empty)";
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

interface WeightedItem {
  item: ContextItem;
  priority: number;
}

export function assembleContext(request: ContextRequest, graph: GraphSnapshot): ContextManifest {
  const budget = request.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  const excluded = new Set([...(request.excludedNodeIds ?? [])]);
  const nodeById = new Map<NodeId, ResearchNodeLike>(graph.nodes.map((n) => [n.id, n]));

  const weighted: WeightedItem[] = [];
  const seen = new Set<NodeId>();
  let truncated = false;

  const addNode = (id: NodeId, role: ContextItemRole, priority: number): void => {
    if (seen.has(id) || excluded.has(id)) return;
    const node = nodeById.get(id);
    if (!node) return;
    if (node.status === "excluded") return;
    seen.add(id);
    weighted.push({
      item: { nodeId: id, role, header: nodeHeader(node), body: nodeBody(node) },
      priority,
    });
  };

  const focalIds = request.focalNodeIds.filter((id) => !excluded.has(id));

  if (request.mode === "branch" || request.mode === "evidence") {
    const chains = focalIds.map((id) => [...ancestorsOf(graph.edges, id)].reverse());
    const maxDepth = chains.reduce((m, c) => Math.max(m, c.length), 0);
    for (let depth = 0; depth < maxDepth; depth++) {
      for (const chain of chains) {
        const id = chain[depth];
        if (id !== undefined) addNode(id, "framing", 10 + depth);
      }
    }
  }

  for (const id of focalIds) addNode(id, "focal", 100);

  for (const id of request.pinnedNodeIds ?? []) addNode(id, "pinned", 80);

  if (request.mode === "evidence" || request.includeSources) {
    const includedIds = weighted.map((w) => w.item.nodeId);
    for (const edge of graph.edges) {
      if (!EVIDENCE_EDGE_TYPES.includes(edge.type)) continue;
      let excerptId: NodeId | null = null;
      if (includedIds.includes(edge.sourceNodeId) && !includedIds.includes(edge.targetNodeId)) {
        excerptId = edge.targetNodeId;
      } else if (
        includedIds.includes(edge.targetNodeId) &&
        !includedIds.includes(edge.sourceNodeId)
      ) {
        excerptId = edge.sourceNodeId;
      }
      if (excerptId === null) continue;
      const candidate = nodeById.get(excerptId);
      if (!candidate || candidate.type !== "excerpt") continue;
      addNode(excerptId, "evidence", 60);
    }
  }

  if (request.mode === "retrieval" && request.query && request.query.trim().length > 0) {
    const queryTokens = tokenize(request.query);
    const candidates = graph.nodes
      .filter((n) => !seen.has(n.id) && !excluded.has(n.id) && n.status !== "excluded")
      .map((node) => ({
        node,
        score: queryTokens.reduce(
          (sum, token) =>
            sum + (`${node.title} ${node.plainText}`.toLowerCase().includes(token) ? 1 : 0),
          0
        ),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));
    for (const { node } of candidates) addNode(node.id, "retrieved", 20);
  }

  weighted.sort((a, b) => a.priority - b.priority || a.item.nodeId.localeCompare(b.item.nodeId));

  const costOf = (w: WeightedItem) => estimateTokens(w.item.header) + estimateTokens(w.item.body);
  let total = weighted.reduce((sum, w) => sum + costOf(w), 0);

  while (total > budget) {
    const droppable = weighted.filter((w) => w.priority < 100);
    if (droppable.length === 0) break;
    let victimIdx = -1;
    let lowestPriority = Number.POSITIVE_INFINITY;
    for (let i = 0; i < weighted.length; i++) {
      const w = weighted[i] as WeightedItem;
      if (w.priority < 100 && w.priority < lowestPriority) {
        lowestPriority = w.priority;
        victimIdx = i;
      }
    }
    if (victimIdx < 0) break;
    const [victim] = weighted.splice(victimIdx, 1);
    total -= costOf(victim as WeightedItem);
    truncated = true;
  }

  if (total > budget && weighted.length > 0) {
    const scale = budget / total;
    for (const entry of weighted) {
      const maxChars = Math.max(48, Math.floor(entry.item.body.length * scale));
      const result = truncateForContext(entry.item.body, maxChars);
      if (result.truncated) truncated = true;
      entry.item.body = result.text;
    }
    total = weighted.reduce((sum, w) => sum + costOf(w), 0);
  }

  const items = weighted.map((w) => w.item);

  return {
    request: { ...request, tokenBudget: budget },
    items,
    includedNodeIds: items.map((i) => i.nodeId),
    estimatedTokens: total,
    truncated,
    policy:
      "ordering: branch framing then focal then pinned then evidence excerpts then retrieved; trimming drops lowest-priority items first, then truncates bodies",
  };
}

export function formatContext(manifest: ContextManifest): string {
  return manifest.items.map((item) => `${item.header}\n${item.body}`).join("\n\n");
}

interface ResearchNodeLike {
  id: NodeId;
  type: string;
  authorKind: string;
  title: string;
  content: string;
  plainText: string;
  status: string;
}
