"use client";

import { create } from "zustand";
import { ensureDefaultProviders } from "@branchwork/models";
import {
  computeLayout,
  parentOf,
  suggestChildPosition,
  wouldCreateAncestryCycle,
} from "@branchwork/graph";
import {
  branchworkExportFileSchema,
  createExportBundle,
  createResearchEdge,
  createResearchNode,
  updateResearchNode,
  type EdgeId,
  type EdgeType,
  type Manuscript,
  type ManuscriptId,
  type ModelRole,
  type ModelRun,
  type NodeId,
  type NodeType,
  type PassageProvenance,
  type Project,
  type ResearchEdge,
  type ResearchNode,
} from "@branchwork/domain";
import type { Viewport } from "./store-types";
import {
  loadModelSettings,
  saveModelSettings,
  EMPTY_SETTINGS,
  type ModelSettings,
} from "./modelSettings";
import { registerGenerationAdapter } from "./generation";
import { createModelRunActions, type ModelRunActions } from "./model-runs";
import { createManuscriptActions, type ManuscriptActions } from "./manuscript-actions";

export const STORAGE_KEY = "branchwork.project.v1";

interface Snapshot {
  project: Project;
  nodes: Record<NodeId, ResearchNode>;
  edges: Record<EdgeId, ResearchEdge>;
}

export interface ContextPreviewState {
  focalNodeId: NodeId;
  role: ModelRole;
  mode: "local" | "branch" | "evidence";
  tokenBudget: number;
}

export interface BranchworkState extends ModelRunActions, ManuscriptActions {
  project: Project;
  nodes: Record<NodeId, ResearchNode>;
  edges: Record<EdgeId, ResearchEdge>;
  manuscripts: Record<ManuscriptId, Manuscript>;
  passages: Record<string, PassageProvenance>;
  runs: Record<string, ModelRun>;
  activeManuscriptId: ManuscriptId | null;

  selectedNodeIds: NodeId[];
  selectedEdgeId: EdgeId | null;
  collapsedIds: Record<NodeId, true>;
  editingNodeId: NodeId | null;
  titleEditNodeId: NodeId | null;
  viewport: Viewport | null;
  activeTab: "canvas" | "manuscript";
  contextPreview: ContextPreviewState | null;
  streamingRunIds: string[];
  backgroundBusyIds: NodeId[];
  toast: string | null;
  loaded: boolean;
  modelSettings: ModelSettings;

  loadFromBundle: (data: unknown) => boolean;
  seedDemoProject: () => void;

  setActiveModel: (modelId: string | null) => void;
  updateModelSettings: (settings: ModelSettings) => void;
  hydrateModelSettings: () => void;

  setProjectTitle: (title: string) => void;
  setActiveTab: (tab: "canvas" | "manuscript") => void;

  addChildNode: (parentId: NodeId, overrides?: { type?: NodeType }) => NodeId | null;
  addSiblingNode: (nodeId: NodeId) => NodeId | null;
  createNodeAt: (type: NodeType, position: { x: number; y: number }) => NodeId;
  breakOutSelection: (sourceId: NodeId, text: string) => NodeId | null;
  updateNode: (
    id: NodeId,
    patch: Partial<Pick<ResearchNode, "type" | "title" | "content" | "status" | "tags">>
  ) => void;
  setNodePosition: (id: NodeId, position: { x: number; y: number }) => void;
  setNodeSize: (id: NodeId, size: { width: number; height: number }) => void;
  deleteNodes: (ids: NodeId[]) => void;
  connectNodes: (
    sourceId: NodeId,
    targetId: NodeId,
    handles?: { sourceHandle?: string | null; targetHandle?: string | null }
  ) => EdgeId | null;
  setEdgeType: (id: EdgeId, type: EdgeType) => void;
  deleteEdge: (id: EdgeId) => void;

  setSelectedNodes: (ids: NodeId[]) => void;
  setSelectedEdge: (id: EdgeId | null) => void;
  setEditingNode: (id: NodeId | null) => void;
  setTitleEditNode: (id: NodeId | null) => void;
  setViewport: (viewport: Viewport) => void;
  toggleCollapse: (id: NodeId) => void;

  layoutSelection: () => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  openContextPreview: (focalNodeId: NodeId) => void;
  closeContextPreview: () => void;
  updateContextPreview: (patch: Partial<ContextPreviewState>) => void;

  exportBundleJson: () => string;
  showToast: (message: string | null) => void;
  /** opens the version-history modal (Ctrl+H / File menu); Workspace listens via subscription */
  setVersionsOpen: (open: boolean) => void;
}

const undoStack: Snapshot[] = [];
const redoStack: Snapshot[] = [];

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function snapshotOf(s: BranchworkState): Snapshot {
  return { project: s.project, nodes: s.nodes, edges: s.edges };
}

ensureDefaultProviders();
registerGenerationAdapter(() => useStore.getState().modelSettings);

export const useStore = create<BranchworkState>()((set, get) => ({
  project: { id: "p_bootstrap", title: "", createdAt: "", updatedAt: "" },
  nodes: {},
  edges: {},
  manuscripts: {},
  passages: {},
  runs: {},
  activeManuscriptId: null,

  selectedNodeIds: [],
  selectedEdgeId: null,
  collapsedIds: {},
  editingNodeId: null,
  titleEditNodeId: null,
  viewport: null,
  activeTab: "canvas",
  contextPreview: null,
  streamingRunIds: [],
  backgroundBusyIds: [],
  toast: null,
  loaded: false,
  modelSettings: EMPTY_SETTINGS,

  ...createModelRunActions(set, get),
  ...createManuscriptActions(set, get),

  showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    if (message !== null) {
      toastTimer = setTimeout(() => set({ toast: null }), 3200);
    }
  },

  // Modal open-state lives outside the store normally (local component state),
  // but keyboard shortcuts need a way to open the Versions modal from anywhere.
  setVersionsOpen(open) {
    document.dispatchEvent(new CustomEvent("bw:versions-open", { detail: open }));
  },

  loadFromBundle(data) {
    const result = branchworkExportFileSchema.safeParse(data);
    if (!result.success) return false;
    const bundle = result.data;
    const nodes: Record<NodeId, ResearchNode> = {};
    for (const node of bundle.nodes) nodes[node.id] = node;
    const edges: Record<EdgeId, ResearchEdge> = {};
    for (const edge of bundle.edges) edges[edge.id] = edge;
    const manuscripts: Record<ManuscriptId, Manuscript> = {};
    for (const m of bundle.manuscripts) manuscripts[m.id] = m;
    const runs: Record<string, ModelRun> = {};
    for (const r of bundle.modelRuns) runs[r.id] = r;
    const passages: Record<string, PassageProvenance> = {};
    for (const p of bundle.passages) passages[`${p.manuscriptId}:${p.passageId}`] = p;
    undoStack.length = 0;
    redoStack.length = 0;
    set({
      project: bundle.project,
      nodes,
      edges,
      manuscripts,
      runs,
      passages,
      activeManuscriptId: Object.keys(manuscripts)[0] ?? null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      collapsedIds: {},
      editingNodeId: null,
      titleEditNodeId: null,
      loaded: true,
    });
    return true;
  },

  seedDemoProject() {
    const project: Project = {
      id: "p_demo",
      title: "Remote work & productivity",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const root = createResearchNode({
      projectId: project.id,
      id: "n_root_question",
      type: "question",
      title: "Does remote work improve knowledge-worker productivity?",
      content:
        "Working question for the essay. Needs a precise definition of productivity and a scope: which workers, which period.",
      position: { x: 60, y: 240 },
    });
    const note = createResearchNode({
      projectId: project.id,
      id: "n_commuter_note",
      type: "note",
      title: "Reclaimed commute time",
      content:
        "Commuting is dead weight for many workers. Reclaiming those hours should show up as either more work or more rest — worth checking which.",
      position: { x: 440, y: 40 },
    });
    const claim = createResearchNode({
      projectId: project.id,
      id: "n_focus_claim",
      type: "claim",
      title: "Remote work increases deep-work hours",
      status: "reviewed",
      position: { x: 440, y: 320 },
    });
    const source = createResearchNode({
      projectId: project.id,
      id: "n_source_study",
      type: "source",
      title: "Example Study (2024)",
      content:
        "Placeholder web source captured for the demo. A real capture with canonical text arrives in the sources milestone.",
      position: { x: 440, y: 600 },
    });
    const excerpt = createResearchNode({
      projectId: project.id,
      id: "n_excerpt_focus",
      type: "excerpt",
      title: "Focus hours rose by 12%",
      content:
        "\u201cParticipants reported a 12% increase in uninterrupted focus blocks during remote periods.\u201d — Example Study, p. 14",
      authorKind: "import",
      position: { x: 820, y: 470 },
    });
    const nodes: Record<NodeId, ResearchNode> = {};
    for (const n of [root, note, claim, source, excerpt]) nodes[n.id] = n;
    const mkEdge = (
      id: string,
      sourceNodeId: NodeId,
      targetNodeId: NodeId,
      type: EdgeType
    ): ResearchEdge =>
      createResearchEdge({ projectId: project.id, id, sourceNodeId, targetNodeId, type });
    const edges: Record<EdgeId, ResearchEdge> = {};
    for (const e of [
      mkEdge("e_root_note", root.id, note.id, "branches_from"),
      mkEdge("e_root_claim", root.id, claim.id, "branches_from"),
      mkEdge("e_root_source", root.id, source.id, "branches_from"),
      mkEdge("e_support", excerpt.id, claim.id, "supports"),
      mkEdge("e_cite", excerpt.id, source.id, "cites"),
    ]) {
      edges[e.id] = e;
    }
    undoStack.length = 0;
    redoStack.length = 0;
    set({
      project,
      nodes,
      edges,
      manuscripts: {},
      passages: {},
      runs: {},
      activeManuscriptId: null,
      selectedNodeIds: [root.id],
      collapsedIds: {},
      editingNodeId: null,
      titleEditNodeId: null,
      contextPreview: null,
      streamingRunIds: [],
      loaded: true,
    });
  },

  setActiveModel(modelId) {
    set((s) => ({ modelSettings: { ...s.modelSettings, activeModelId: modelId } }));
  },

  updateModelSettings(settings) {
    saveModelSettings(settings);
    set({ modelSettings: settings });
  },

  hydrateModelSettings() {
    const settings = loadModelSettings();
    set({ modelSettings: settings });
  },

  setProjectTitle(title) {
    set((s) => ({ project: { ...s.project, title, updatedAt: new Date().toISOString() } }));
  },

  setActiveTab(tab) {
    set({ activeTab: tab });
  },

  pushHistory() {
    undoStack.push(snapshotOf(get()));
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  },

  undo() {
    const prev = undoStack.pop();
    if (!prev) return;
    redoStack.push(snapshotOf(get()));
    set(prev);
  },

  redo() {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(snapshotOf(get()));
    set(next);
  },

  addChildNode(parentId, overrides) {
    const s = get();
    const parent = s.nodes[parentId];
    if (!parent) return null;
    s.pushHistory();
    const existingSiblings = Object.values(s.edges)
      .filter((e) => e.type === "branches_from" && e.sourceNodeId === parentId)
      .map((e) => s.nodes[e.targetNodeId])
      .filter((n): n is ResearchNode => Boolean(n));
    const child = createResearchNode({
      projectId: s.project.id,
      type: overrides?.type ?? "note",
      position: suggestChildPosition(parent, existingSiblings),
    });
    const edge = createResearchEdge({
      projectId: s.project.id,
      sourceNodeId: parentId,
      targetNodeId: child.id,
      type: "branches_from",
    });
    set((st) => ({
      nodes: { ...st.nodes, [child.id]: child },
      edges: { ...st.edges, [edge.id]: edge },
      titleEditNodeId: child.id,
    }));
    return child.id;
  },

  addSiblingNode(nodeId) {
    const s = get();
    const node = s.nodes[nodeId];
    if (!node) return null;
    const parentId = parentOf(Object.values(s.edges), nodeId);
    if (!parentId || !s.nodes[parentId]) return get().addChildNode(nodeId);
    const parent = s.nodes[parentId];
    const siblings = Object.values(s.edges)
      .filter((e) => e.type === "branches_from" && e.sourceNodeId === parentId)
      .map((e) => s.nodes[e.targetNodeId])
      .filter((n): n is ResearchNode => Boolean(n));
    get().pushHistory();
    const sibling = createResearchNode({
      projectId: s.project.id,
      type: node.type === "question" ? "note" : node.type,
      position: suggestChildPosition(parent, siblings),
    });
    const edge = createResearchEdge({
      projectId: s.project.id,
      sourceNodeId: parentId,
      targetNodeId: sibling.id,
      type: "branches_from",
    });
    set((st) => ({
      nodes: { ...st.nodes, [sibling.id]: sibling },
      edges: { ...st.edges, [edge.id]: edge },
      titleEditNodeId: sibling.id,
    }));
    return sibling.id;
  },

  createNodeAt(type, position) {
    const s = get();
    s.pushHistory();
    const node = createResearchNode({
      projectId: s.project.id,
      type,
      position,
    });
    set((st) => ({
      nodes: { ...st.nodes, [node.id]: node },
      titleEditNodeId: node.id,
    }));
    return node.id;
  },

  breakOutSelection(sourceId, text) {
    const s = get();
    const source = s.nodes[sourceId];
    const clean = text.trim();
    if (!source || !clean) return null;
    s.pushHistory();

    // remove the excerpt from the source body when it appears verbatim
    let nextContent = source.content;
    const idx = nextContent.indexOf(clean);
    let removed = false;
    if (idx !== -1) {
      nextContent = (
        nextContent.slice(0, idx) + nextContent.slice(idx + clean.length)
      ).replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
      removed = true;
    }

    const siblings = Object.values(s.edges)
      .filter((e) => e.type === "branches_from" && e.sourceNodeId === sourceId)
      .map((e) => s.nodes[e.targetNodeId])
      .filter((n): n is ResearchNode => Boolean(n));
    const child = createResearchNode({
      projectId: s.project.id,
      type: "excerpt",
      title: clean.split("\n")[0]?.slice(0, 60) || "Excerpt",
      content: clean,
      position: suggestChildPosition(source, siblings),
    });
    const edge = createResearchEdge({
      projectId: s.project.id,
      sourceNodeId: sourceId,
      targetNodeId: child.id,
      type: "branches_from",
    });

    set((st) => {
      const nodes = { ...st.nodes, [child.id]: child };
      const sourceNode = st.nodes[sourceId];
      if (removed && sourceNode) nodes[sourceId] = { ...sourceNode, content: nextContent };
      return {
        nodes,
        edges: { ...st.edges, [edge.id]: edge },
        selectedNodeIds: [child.id],
        editingNodeId: null,
      };
    });
    return child.id;
  },

  updateNode(id, patch) {
    set((s) => {
      const node = s.nodes[id];
      if (!node) return {};
      const updated = updateResearchNode(node, patch);
      return { nodes: { ...s.nodes, [id]: updated } };
    });
  },

  setNodePosition(id, position) {
    set((s) => {
      const node = s.nodes[id];
      if (!node) return {};
      if (node.position.x === position.x && node.position.y === position.y) return {};
      return { nodes: { ...s.nodes, [id]: { ...node, position } } };
    });
  },

  setNodeSize(id, size) {
    set((s) => {
      const node = s.nodes[id];
      if (!node) return {};
      if (node.size && Math.abs(node.size.width - size.width) < 1 && Math.abs(node.size.height - size.height) < 1) {
        return {};
      }
      return { nodes: { ...s.nodes, [id]: { ...node, size } } };
    });
  },

  deleteNodes(ids) {
    const s = get();
    if (ids.length === 0) return;
    s.pushHistory();
    const idSet = new Set(ids);
    const nodes = { ...s.nodes };
    for (const id of ids) delete nodes[id];
    const edges: Record<EdgeId, ResearchEdge> = {};
    for (const edge of Object.values(s.edges)) {
      if (idSet.has(edge.sourceNodeId) || idSet.has(edge.targetNodeId)) continue;
      edges[edge.id] = edge;
    }
    set((st) => ({
      nodes,
      edges,
      selectedNodeIds: st.selectedNodeIds.filter((x) => !idSet.has(x)),
      editingNodeId: st.editingNodeId && idSet.has(st.editingNodeId) ? null : st.editingNodeId,
      titleEditNodeId: st.titleEditNodeId && idSet.has(st.titleEditNodeId) ? null : st.titleEditNodeId,
    }));
  },

  connectNodes(sourceId, targetId, handles) {
    const s = get();
    if (sourceId === targetId) return null;
    if (!s.nodes[sourceId] || !s.nodes[targetId]) return null;
    const duplicate = Object.values(s.edges).some(
      (e) =>
        e.type === "branches_from" &&
        e.sourceNodeId === sourceId &&
        e.targetNodeId === targetId
    );
    if (
      duplicate ||
      wouldCreateAncestryCycle(Object.values(s.edges), sourceId, targetId)
    ) {
      get().showToast("That connection would create a cycle in the branch ancestry.");
      return null;
    }
    s.pushHistory();
    const edge = createResearchEdge({
      projectId: s.project.id,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      type: "branches_from",
      ...(handles?.sourceHandle ? { sourceHandle: handles.sourceHandle } : {}),
      ...(handles?.targetHandle ? { targetHandle: handles.targetHandle } : {}),
    });
    set((st) => ({ edges: { ...st.edges, [edge.id]: edge }, selectedEdgeId: edge.id }));
    return edge.id;
  },

  setEdgeType(id, type) {
    set((s) => {
      const edge = s.edges[id];
      if (!edge) return {};
      return { edges: { ...s.edges, [id]: { ...edge, type } } };
    });
  },

  deleteEdge(id) {
    const s = get();
    s.pushHistory();
    const edges = { ...s.edges };
    delete edges[id];
    set({ edges, selectedEdgeId: null });
  },

  setSelectedNodes(ids) {
    set({ selectedNodeIds: ids });
  },

  setSelectedEdge(id) {
    set({ selectedEdgeId: id, selectedNodeIds: [] });
  },

  setEditingNode(id) {
    set({ editingNodeId: id });
  },

  setTitleEditNode(id) {
    set({ titleEditNodeId: id });
  },

  setViewport(viewport) {
    set({ viewport });
  },

  toggleCollapse(id) {
    set((s) => {
      const collapsedIds = { ...s.collapsedIds };
      if (collapsedIds[id]) {
        delete collapsedIds[id];
      } else {
        collapsedIds[id] = true;
      }
      return { collapsedIds };
    });
  },

  layoutSelection() {
    const s = get();
    const selection = s.selectedNodeIds.filter((id) => s.nodes[id]);
    if (selection.length === 0) {
      s.showToast("Select cards to lay out first.");
      return;
    }
    const allEdges = Object.values(s.edges);
    const scopeRoots = selection.filter((id) => {
      const parentId = parentOf(allEdges, id);
      return !parentId || !selection.includes(parentId);
    });

    const result = computeLayout(
      { nodes: Object.values(s.nodes), edges: allEdges },
      scopeRoots.length > 0
        ? { kind: "subtree", rootIds: scopeRoots }
        : { kind: "selection", nodeIds: selection }
    );
    if (result.movedNodeIds.length === 0) return;
    get().pushHistory();
    set((st) => {
      const nodes = { ...st.nodes };
      for (const [id, position] of result.positions) {
        const node = nodes[id];
        if (node) nodes[id] = { ...node, position };
      }
      return { nodes };
    });
  },

  openContextPreview(focalNodeId) {
    set({ contextPreview: { focalNodeId, role: "quick_explore", mode: "branch", tokenBudget: 6000 } });
  },

  closeContextPreview() {
    set({ contextPreview: null });
  },

  updateContextPreview(patch) {
    set((s) => (s.contextPreview ? { contextPreview: { ...s.contextPreview, ...patch } } : {}));
  },

  exportBundleJson() {
    const s = get();
    return JSON.stringify(
      createExportBundle({
        project: s.project,
        nodes: Object.values(s.nodes),
        edges: Object.values(s.edges),
        manuscripts: Object.values(s.manuscripts),
        modelRuns: Object.values(s.runs),
        passages: Object.values(s.passages),
      }),
      null,
      2
    );
  },
}));
