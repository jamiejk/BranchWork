"use client";

// Model-run slice: exploration runs (✦ ask), their streaming lifecycle, and
// post-stream source extraction. Pure orchestration lives here; the store
// composes it in.

import {
  globalRegistry,
  ROLE_PRESETS,
} from "@branchwork/models";
import {
  assembleContext,
  estimateTokens,
  formatContext,
  suggestChildPosition,
} from "@branchwork/graph";
import {
  createModelRun,
  createResearchEdge,
  createResearchNode,
  derivePlainText,
  type ModelRun,
  type NodeType,
  type NodeId,
  type PassageProvenance,
  type ResearchEdge,
  type ResearchNode,
} from "@branchwork/domain";
import { resolveAdapter, resolveExtraction } from "./generation";
import {
  ENTITY_PROMPT,
  EXTRACTION_PROMPT,
  extractionConfigured,
  parseExtractedEntities,
  parseExtractedSources,
  planNewEntityNodes,
  planNewSourceNodes,
  sourceNodePosition,
  MAX_ENTITIES_PER_RUN,
  MAX_SOURCES_PER_RUN,
} from "./source-extraction";

type SetFn = (partial: Partial<BranchworkState> | ((s: BranchworkState) => Partial<BranchworkState>)) => void;
type GetFn = () => BranchworkState;

import type { BranchworkState } from "./store";

const runControllers = new Map<string, AbortController>();

export interface ModelRunActions {
  runExploration: () => Promise<void>;
  cancelRun: (runId: string) => void;
  /** Ask the background model for a concise title (used on first capture). */
  generateTitle: (nodeId: NodeId) => Promise<void>;
}

export function createModelRunActions(set: SetFn, get: GetFn): ModelRunActions {
  return {
    async runExploration() {
      await executeExploration(set, get);
    },

    cancelRun(runId) {
      runControllers.get(runId)?.abort();
    },

    async generateTitle(nodeId) {
      try {
        const s = get();
        const node = s.nodes[nodeId];
        if (!node || node.title.trim()) return;
        if (!extractionConfigured(s.modelSettings)) return;
        const gen = resolveExtraction(s.modelSettings);
        if (!gen) return;
        const adapter = globalRegistry.get(gen.adapterId);
        const source = (node.content || node.plainText).slice(0, 4000);
        if (!source.trim()) return;
        const title = await adapter.generateObject({
          providerId: gen.providerId,
          modelId: gen.modelId,
          role: "quick_explore",
          kind: "title",
          prompt:
            'Write a concise title (3-8 words) that captures the main point of this note. ' +
            'Respond with JSON: {"title": "..."}. No punctuation at the end.',
          payload: { text: source },
          parse: parseGeneratedTitle,
        });
        // still empty? the user may have typed one meanwhile — respect that
        const fresh = get().nodes[nodeId];
        if (!fresh || fresh.title.trim()) return;
        set((st) => {
          const target = st.nodes[nodeId];
          if (!target) return {};
          return { nodes: { ...st.nodes, [nodeId]: { ...target, title } } };
        });
      } catch {
        // cosmetic background task — silence is fine
      }
    },
  };
}

function parseGeneratedTitle(raw: unknown): string {
  let candidate: unknown = raw;
  if (raw && typeof raw === "object" && "title" in raw) {
    candidate = (raw as { title?: unknown }).title;
  }
  if (typeof candidate !== "string") throw new Error("no title");
  const clean = candidate.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
  if (!clean) throw new Error("empty title");
  return clean.slice(0, 110);
}

async function executeExploration(set: SetFn, get: GetFn): Promise<void> {
  const preview = get().contextPreview;
  if (!preview) return;
  const s = get();
  const focal = s.nodes[preview.focalNodeId];
  if (!focal) return;

  const gen = resolveAdapter(s.modelSettings, ROLE_PRESETS[preview.role].defaultModelId);
  const manifest = assembleContext(
    { focalNodeIds: [focal.id], mode: preview.mode, tokenBudget: preview.tokenBudget },
    { nodes: Object.values(s.nodes), edges: Object.values(s.edges) }
  );

  const role = preview.role;
  const preset = ROLE_PRESETS[role];

  const childCount = Object.values(s.edges).filter(
    (e) => e.type === "branches_from" && e.sourceNodeId === focal.id
  ).length;

  const run = createModelRun({
    projectId: s.project.id,
    providerId: gen.providerId,
    modelId: gen.modelId,
    role,
    systemInstructions: preset.systemInstructions,
    userPrompt:
      focal.title.trim() || focal.plainText.slice(0, 200) || "Explore this branch.",
    contextNodeIds: manifest.includedNodeIds,
    status: "streaming",
  });

  const provisional = createResearchNode({
    projectId: s.project.id,
    type: "exploration",
    title: preset.label,
    authorKind: "model",
    modelRunId: run.id,
    position: suggestChildPosition(focal, Array.from({ length: childCount }, () => focal)),
  });

  const edge = createResearchEdge({
    projectId: s.project.id,
    sourceNodeId: focal.id,
    targetNodeId: provisional.id,
    type: "branches_from",
    createdBy: "model",
  });

  const controller = new AbortController();
  runControllers.set(run.id, controller);

  get().pushHistory();
  set((st) => ({
    runs: { ...st.runs, [run.id]: run },
    nodes: { ...st.nodes, [provisional.id]: provisional },
    edges: { ...st.edges, [edge.id]: edge },
    streamingRunIds: [...st.streamingRunIds, run.id],
    contextPreview: null,
    selectedNodeIds: [provisional.id],
  }));

  let buffer = "";
  let lastFlush = Date.now();
  let cancelled = false;

  try {
    const adapter = globalRegistry.get(gen.adapterId);
    for await (const event of adapter.streamText({
      providerId: gen.providerId,
      modelId: gen.modelId,
      role,
      system: preset.systemInstructions,
      prompt: run.userPrompt,
      contextText: formatContext(manifest),
      reasoningEffort: gen.reasoningEffort,
      signal: controller.signal,
    })) {
      if (event.type === "delta") {
        buffer += event.text;
        if (Date.now() - lastFlush > 90) {
          lastFlush = Date.now();
          flushStreamingNode(set, provisional.id, buffer);
        }
      } else if (event.type === "done") {
        cancelled = event.finishReason === "cancelled";
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
    finalizeExploration(
      set,
      provisional.id,
      buffer.trim(),
      run.id,
      cancelled ? "cancelled" : "completed",
      manifest.estimatedTokens,
      estimateTokens(buffer)
    );
    if (!cancelled) {
      void runPostStreamExtractions(set, get, provisional.id, buffer.trim());
    }
  } catch (error) {
    finalizeExploration(
      set,
      provisional.id,
      buffer.trim(),
      run.id,
      "failed",
      manifest.estimatedTokens,
      estimateTokens(buffer),
      (error as Error).message
    );
    get().showToast(`Exploration failed: ${(error as Error).message}`);
  } finally {
    runControllers.delete(run.id);
    set((st) => ({ streamingRunIds: st.streamingRunIds.filter((x) => x !== run.id) }));
  }
}

/** Best-effort post-stream passes: cited sources + key entities. Never throws. */
async function runPostStreamExtractions(
  set: SetFn,
  get: GetFn,
  parentId: NodeId,
  text: string
): Promise<void> {
  try {
    const s = get();
    if (!extractionConfigured(s.modelSettings)) return;
    const parent = s.nodes[parentId];
    if (!parent || !text) return;

    const gen = resolveExtraction(s.modelSettings);
    if (!gen) return;
    const adapter = globalRegistry.get(gen.adapterId);

    // pass 1: cited sources
    let extractedSources: Array<{ title: string; url: string }> = [];
    try {
      extractedSources = await adapter.generateObject({
        providerId: gen.providerId,
        modelId: gen.modelId,
        role: "source_analyst",
        kind: "sources",
        prompt: EXTRACTION_PROMPT,
        payload: { text: text.slice(0, 12000) },
        parse: parseExtractedSources,
      });
    } catch {
      // non-fatal; entity extraction still runs
    }
    if (extractedSources.length > 0) {
      attachSourceNodes(set, get, parentId, extractedSources.slice(0, MAX_SOURCES_PER_RUN));
    }

    // pass 2: key entities -> concept cards
    let extractedEntities: Array<{ name: string; kind: string }> = [];
    try {
      extractedEntities = await adapter.generateObject({
        providerId: gen.providerId,
        modelId: gen.modelId,
        role: "source_analyst",
        kind: "entities",
        prompt: ENTITY_PROMPT,
        payload: { text: text.slice(0, 12000) },
        parse: parseExtractedEntities,
      });
    } catch {
      // non-fatal
    }
    if (extractedEntities.length > 0) {
      attachEntityNodes(set, get, parentId, extractedEntities.slice(0, MAX_ENTITIES_PER_RUN));
    }
  } catch {
    // extraction is a bonus; never surface failures from it
  }
}

/** Map the extractor's kind field onto real card types. */
function entityTypeForKind(kind: string): NodeType {
  switch (kind) {
    case "person":
      return "person";
    case "work":
    case "organisation":
    case "event":
    case "technology":
      return "entity";
    default:
      return "concept";
  }
}

function attachEntityNodes(
  set: SetFn,
  get: GetFn,
  parentId: NodeId,
  entities: Array<{ name: string; kind: string }>
): void {
  const s = get();
  const parent = s.nodes[parentId];
  if (!parent) return;
  const plan = planNewEntityNodes(s.nodes, entities);
  if (plan.length === 0) return;

  const nodes: Record<string, ResearchNode> = {};
  const edges: Record<string, ResearchEdge> = {};
  plan.forEach((entity, index) => {
    const node = createResearchNode({
      projectId: s.project.id,
      type: entityTypeForKind(entity.kind),
      title: entity.name,
      content: `Surfaced as a ${entity.kind} in this branch.`,
      authorKind: "model",
      position: {
        x: parent.position.x + index * 60,
        y: parent.position.y + (parent.size?.height ?? 200) + 140 + index * 130,
      },
    });
    nodes[node.id] = node;
    const edge = createResearchEdge({
      projectId: s.project.id,
      sourceNodeId: parentId,
      targetNodeId: node.id,
      type: "related_to",
      createdBy: "model",
    });
    edges[edge.id] = edge;
  });

  get().pushHistory();
  set((st) => ({
    nodes: { ...st.nodes, ...nodes },
    edges: { ...st.edges, ...edges },
  }));
  get().showToast(`Entities: ${plan.length} concept card${plan.length === 1 ? "" : "s"} added.`);
}

function attachSourceNodes(
  set: SetFn,
  get: GetFn,
  parentId: NodeId,
  sources: Array<{ title: string; url: string }>
): void {
  const s = get();
  const parent = s.nodes[parentId];
  if (!parent) return;

  const plan = planNewSourceNodes(s.nodes, sources);
  const linkedExisting = sources.length - plan.length;

  let nodeIndex = 0;
  const nodes: Record<string, ResearchNode> = {};
  const edges: Record<string, ResearchEdge> = {};
  const provenancePassages: Record<string, PassageProvenance> = {};

  for (const item of plan) {
    const node = createResearchNode({
      projectId: s.project.id,
      type: "source",
      title: item.title,
      content: item.url,
      authorKind: "model",
      position: sourceNodePosition(parent, nodeIndex),
    });
    nodes[node.id] = node;
    const edge = createResearchEdge({
      projectId: s.project.id,
      sourceNodeId: parentId,
      targetNodeId: node.id,
      type: "cites",
      createdBy: "model",
    });
    edges[edge.id] = edge;
    nodeIndex += 1;
  }

  if (nodeIndex === 0 && linkedExisting === 0) return;

  get().pushHistory();
  set((st) => ({
    nodes: { ...st.nodes, ...nodes },
    edges: { ...st.edges, ...edges },
  }));

  const attached = nodeIndex;
  if (attached > 0 || linkedExisting > 0) {
    const parts = [];
    if (attached > 0) parts.push(`${attached} source node${attached === 1 ? "" : "s"} added`);
    if (linkedExisting > 0) parts.push(`${linkedExisting} already known`);
    get().showToast(`Sources: ${parts.join(", ")}.`);
  }
  void provenancePassages;
}

function flushStreamingNode(set: SetFn, nodeId: NodeId, text: string): void {
  set((st) => {
    const node = st.nodes[nodeId];
    if (!node) return {};
    return { nodes: { ...st.nodes, [nodeId]: { ...node, plainText: text } } };
  });
}

function finalizeExploration(
  set: SetFn,
  nodeId: NodeId,
  text: string,
  runId: string,
  status: ModelRun["status"],
  inputTokens: number,
  outputTokens: number,
  errorMessage?: string
): void {
  set((st) => {
    const node = st.nodes[nodeId];
    const run = st.runs[runId];
    if (!node || !run) return {};
    const title = status === "cancelled" ? `${node.title} (partial)` : text.split(/(?<=[.!?])\s/)[0]?.slice(0, 110) || node.title;
    // title and body are independent fields now; don't repeat the title sentence
    let content = text;
    const t = title.trim();
    if (t && content.startsWith(t)) {
      content = content.slice(t.length).replace(/^\s+/, "");
    }
    return {
      nodes: {
        ...st.nodes,
        [nodeId]: {
          ...node,
          title,
          content,
          plainText: derivePlainText(text),
        },
      },
      runs: {
        ...st.runs,
        [runId]: {
          ...run,
          status,
          ...(errorMessage ? { error: errorMessage } : {}),
          completedAt: new Date().toISOString(),
          inputTokens,
          outputTokens,
        },
      },
    };
  });
}
