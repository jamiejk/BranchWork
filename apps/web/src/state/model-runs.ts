"use client";

// Model-run slice: exploration runs (✦ ask), their streaming lifecycle, and
// post-stream source extraction. Pure orchestration lives here; the store
// composes it in.

import { NODE_TYPE_REGISTRY } from "@branchwork/domain";
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
  BUILD_OUT_PROMPT,
  ENTITY_PROMPT,
  EXTRACTION_PROMPT,
  SEARCH_QUERIES_PROMPT,
  extractionConfigured,
  parseBuildOut,
  parseExtractedEntities,
  parseExtractedSources,
  parseSearchQueries,
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
  /** Ask the background model to suggest related sources/people/concepts. */
  buildOutBranch: (nodeId: NodeId) => Promise<void>;
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
      set((s) => ({ backgroundBusyIds: [...s.backgroundBusyIds, nodeId] }));
      try {
        const s = get();
        const node = s.nodes[nodeId];
        if (!node || !node.title.trim()) return; // nothing to improve
        if (!extractionConfigured(s.modelSettings)) return;
        const gen = resolveExtraction(s.modelSettings);
        if (!gen) return;
        const adapter = globalRegistry.get(gen.adapterId);
        const source = (node.content || node.plainText).slice(0, 4000);
        if (!source.trim()) return;

        // Remember the placeholder so we don't clobber a manual rename that
        // happens while the request is in flight.
        const placeholderTitle = node.title;

        const title = await adapter.generateObject({
          providerId: gen.providerId,
          modelId: gen.modelId,
          role: "quick_explore",
          kind: "title",
          prompt:
            'Write a concise title (3-8 words) that captures the main point of this note. ' +
            'Respond with JSON: {"title": "..."}. No punctuation at the end. ' +
            "Do not simply repeat the first line — summarise the overall idea.",
          payload: { text: source },
          parse: parseGeneratedTitle,
        });

        const fresh = get().nodes[nodeId];
        if (!fresh || fresh.title !== placeholderTitle) return; // user renamed meanwhile

        set((st) => {
          const target = st.nodes[nodeId];
          if (!target) return {};
          return { nodes: { ...st.nodes, [nodeId]: { ...target, title } } };
        });
      } catch {
        // cosmetic background task — the first-line title just stays
      } finally {
        set((s) => ({ backgroundBusyIds: s.backgroundBusyIds.filter((id) => id !== nodeId) }));
      }
    },

    async buildOutBranch(nodeId) {
      set((s) => ({ backgroundBusyIds: [...s.backgroundBusyIds, nodeId] }));
      try {
        const s = get();
        const parent = s.nodes[nodeId];
        if (!parent) return;
        if (!extractionConfigured(s.modelSettings)) {
          get().showToast("Configure a background model in ⚙ Models to use Build out.");
          return;
        }
        const gen = resolveExtraction(s.modelSettings);
        if (!gen) return;
        const adapter = globalRegistry.get(gen.adapterId);

        // Card subject: title + type + body. A one-liner card keeps its text
        // in the title, so the title is the most important part of the source.
        const typeLabel = NODE_TYPE_REGISTRY[parent.type]?.label ?? parent.type;
        const body = (parent.content || "").slice(0, 4000);
        const subject = [`Card: ${parent.title} (type: ${typeLabel})`, body && `Body:\n${body}`]
          .filter(Boolean)
          .join("\n");

        // Context from the linked card one level back (first incoming edge).
        let parentContext = "";
        const incoming = Object.values(s.edges).find((e) => e.targetNodeId === nodeId);
        const upstream = incoming ? s.nodes[incoming.sourceNodeId] : undefined;
        if (upstream && (upstream.title || upstream.content)) {
          parentContext =
            `Parent note for context: ${upstream.title}\n` +
            (upstream.content || "").slice(0, 1200);
        }
        if (!subject.trim() && !parentContext) {
          get().showToast("This card has no content to build out from yet.");
          return;
        }

        get().showToast("Building out branch…");

        // Phase 1: ask Gemma for search queries
        let searchResults: Array<{ title: string; url: string; snippet: string; cardType: string }> = [];
        try {
          const queries = await adapter.generateObject({
            providerId: gen.providerId,
            modelId: gen.modelId,
            role: "quick_explore",
            kind: "search_queries",
            prompt:
              `${SEARCH_QUERIES_PROMPT}\n\n${parentContext ? parentContext + "\n\n" : ""}${subject}`,
            parse: parseSearchQueries,
          });
          if (queries.length > 0) {
            // Phase 2: run ddgr with those queries via the API route
            const res = await fetch("/api/build-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ queries: queries.map((q) => [q.query, q.cardType]) }),
            });
            if (res.ok) {
              const data = await res.json();
              searchResults = data.results ?? [];
            }
          }
        } catch {
          // web search is optional; Gemma's own suggestions still work below
        }

        // Phase 3: Gemma's knowledge-based suggestions for people & concepts
        let gemmaSuggestions: { persons: Array<{ name: string; role: string }>; concepts: Array<{ name: string; definition: string }> } = {
          persons: [], concepts: [],
        };
        try {
          gemmaSuggestions = await adapter.generateObject({
            providerId: gen.providerId,
            modelId: gen.modelId,
            role: "quick_explore",
            kind: "build_out",
            prompt:
              `${BUILD_OUT_PROMPT}\n\n${parentContext ? parentContext + "\n\n" : ""}${subject}`,
            parse: parseBuildOut,
          });
        } catch {
          // non-fatal
        }

        // Format everything as markdown and append to the card body
        const sections: string[] = [];

        if (searchResults.length > 0) {
          sections.push(
            "### Web sources\n" +
            searchResults.map((r) => `- [${r.title}](${r.url})${r.snippet ? `\n  ${r.snippet.slice(0, 200)}` : ""}`).join("\n")
          );
        }
        if (gemmaSuggestions.persons.length > 0) {
          sections.push(
            "### People\n" +
            gemmaSuggestions.persons.map((p) => `- **${p.name}**${p.role ? ` — ${p.role}` : ""}`).join("\n")
          );
        }
        if (gemmaSuggestions.concepts.length > 0) {
          sections.push(
            "### Concepts\n" +
            gemmaSuggestions.concepts.map((c) => `- **${c.name}**${c.definition ? `: ${c.definition}` : ""}`).join("\n")
          );
        }

        if (sections.length === 0) {
          get().showToast("Build out found nothing new.");
          return;
        }

        const addition = "\n\n---\n\n" + sections.join("\n\n");

        get().pushHistory();
        set((st) => {
          const node = st.nodes[nodeId];
          if (!node) return {};
          // read fresh content so we never clobber edits made while running
          const nextContent = (node.content || "") + addition;
          return { nodes: { ...st.nodes, [nodeId]: { ...node, content: nextContent } } };
        });

        const counts = [
          searchResults.length ? `${searchResults.length} web results` : "",
          gemmaSuggestions.persons.length ? `${gemmaSuggestions.persons.length} people` : "",
          gemmaSuggestions.concepts.length ? `${gemmaSuggestions.concepts.length} concepts` : "",
        ].filter(Boolean);
        get().showToast(`Build out appended: ${counts.join(", ")}.`);
      } catch (error) {
        get().showToast(`Build out failed: ${(error as Error).message}`);
      } finally {
        set((s) => ({ backgroundBusyIds: s.backgroundBusyIds.filter((id) => id !== nodeId) }));
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
