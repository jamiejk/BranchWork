"use client";

// Manuscript slice: outline generation, section ordering/editing, and prose
// drafting with provenance. The store composes these actions in.

import { globalRegistry, ROLE_PRESETS } from "@branchwork/models";
import { assembleContext, estimateTokens, formatContext } from "@branchwork/graph";
import {
  createManuscript,
  createModelRun,
  type Manuscript,
  type ManuscriptId,
  type PassageProvenance,
} from "@branchwork/domain";
import { resolveAdapter } from "./generation";
import { buildMockOutlinePayload as buildOutlinePayload, parseMockOutline as parseOutlinePayload } from "./store-types";

type SetFn = (partial: Partial<BranchworkState> | ((s: BranchworkState) => Partial<BranchworkState>)) => void;
type GetFn = () => BranchworkState;

import type { BranchworkState } from "./store";

const runControllers = new Map<string, AbortController>();

export interface ManuscriptActions {
  ensureManuscript: () => ManuscriptId;
  generateOutlineFromSelection: () => Promise<void>;
  reorderSection: (sectionId: string, direction: -1 | 1) => void;
  updateSectionHeading: (sectionId: string, heading: string) => void;
  updateSectionDraft: (sectionId: string, draft: string) => void;
  draftSection: (sectionId: string) => Promise<void>;
}

export function createManuscriptActions(set: SetFn, get: GetFn): ManuscriptActions {
  return {
    ensureManuscript() {
      const s = get();
      if (s.activeManuscriptId && s.manuscripts[s.activeManuscriptId]) return s.activeManuscriptId;
      const manuscript = createManuscript({
        projectId: s.project.id,
        title: `${s.project.title || "Project"} — essay`,
      });
      set((st) => ({
        manuscripts: { ...st.manuscripts, [manuscript.id]: manuscript },
        activeManuscriptId: manuscript.id,
      }));
      return manuscript.id;
    },

    async generateOutlineFromSelection() {
      const s = get();
      const selection = s.selectedNodeIds.filter((id) => s.nodes[id]);
      if (selection.length === 0) {
        s.showToast("Select some cards on the canvas first.");
        return;
      }
      const gen = resolveAdapter(s.modelSettings, ROLE_PRESETS.outline_builder.defaultModelId);
      const adapter = globalRegistry.get(gen.adapterId);
      const payload = buildOutlinePayload(selection.map((id) => s.nodes[id]!));
      try {
        const sections = await adapter.generateObject({
          providerId: gen.providerId,
          modelId: gen.modelId,
          role: "outline_builder",
          kind: "outline",
          prompt: "Propose an argument structure for these research nodes.",
          payload,
          parse: parseOutlinePayload,
        });
        const manuscriptId = get().ensureManuscript();
        get().pushHistory();
        set((st) => {
          const manuscript = st.manuscripts[manuscriptId];
          if (!manuscript) return {};
          const updated: Manuscript = {
            ...manuscript,
            outline: sections.map((section, index) => ({
              id: `sec_${index + 1}`,
              heading: section.heading,
              order: index,
              purpose: section.purpose,
              nodeRefs: section.nodeRefs.filter((ref) => st.nodes[ref]),
              children: [],
            })),
            updatedAt: new Date().toISOString(),
          };
          return {
            manuscripts: { ...st.manuscripts, [manuscriptId]: updated },
            activeTab: "manuscript",
          };
        });
        get().showToast("Outline generated — every part stays editable.");
      } catch (error) {
        get().showToast(`Outline generation failed: ${(error as Error).message}`);
      }
    },

    reorderSection(sectionId, direction) {
      const s = get();
      const manuscriptId = s.ensureManuscript();
      const manuscript = get().manuscripts[manuscriptId];
      if (!manuscript) return;
      const sections = [...manuscript.outline].sort((a, b) => a.order - b.order);
      const index = sections.findIndex((sec) => sec.id === sectionId);
      const swapWith = index + direction;
      if (index < 0 || swapWith < 0 || swapWith >= sections.length) return;
      get().pushHistory();
      const reordered = [...sections];
      reordered[index] = sections[swapWith]!;
      reordered[swapWith] = sections[index]!;
      const normalized = reordered.map((sec, i) => ({ ...sec, order: i }));
      set((st) => ({
        manuscripts: {
          ...st.manuscripts,
          [manuscriptId]: { ...manuscript, outline: normalized, updatedAt: new Date().toISOString() },
        },
      }));
    },

    updateSectionHeading(sectionId, heading) {
      const manuscriptId = get().ensureManuscript();
      set((st) => {
        const manuscript = st.manuscripts[manuscriptId];
        if (!manuscript) return {};
        const outline = manuscript.outline.map((sec) =>
          sec.id === sectionId ? { ...sec, heading } : sec
        );
        return {
          manuscripts: {
            ...st.manuscripts,
            [manuscriptId]: { ...manuscript, outline, updatedAt: new Date().toISOString() },
          },
        };
      });
    },

    updateSectionDraft(sectionId, draft) {
      const manuscriptId = get().ensureManuscript();
      set((st) => {
        const manuscript = st.manuscripts[manuscriptId];
        if (!manuscript) return {};
        const outline = manuscript.outline.map((sec) =>
          sec.id === sectionId ? { ...sec, draft } : sec
        );
        return {
          manuscripts: {
            ...st.manuscripts,
            [manuscriptId]: { ...manuscript, outline },
          },
        };
      });
    },

    async draftSection(sectionId) {
      const s = get();
      const manuscriptId = s.ensureManuscript();
      const manuscript = get().manuscripts[manuscriptId];
      const section = manuscript?.outline.find((sec) => sec.id === sectionId);
      if (!manuscript || !section) return;
      const nodeRefs = section.nodeRefs.filter((id) => get().nodes[id]);
      if (nodeRefs.length === 0) {
        get().showToast("This section references no cards yet. Add some on the canvas first.");
        return;
      }
      const gen = resolveAdapter(get().modelSettings, ROLE_PRESETS.prose_drafter.defaultModelId);
      const manifest = assembleContext(
        { focalNodeIds: nodeRefs, mode: "evidence", tokenBudget: 6000 },
        { nodes: Object.values(get().nodes), edges: Object.values(get().edges) }
      );
      const preset = ROLE_PRESETS.prose_drafter;
      const run = createModelRun({
        projectId: get().project.id,
        providerId: gen.providerId,
        modelId: gen.modelId,
        role: "prose_drafter",
        systemInstructions: preset.systemInstructions,
        userPrompt: `Draft the section "${section.heading}".`,
        contextNodeIds: manifest.includedNodeIds,
        status: "streaming",
      });
      const controller = new AbortController();
      runControllers.set(run.id, controller);
      set((st) => ({
        runs: { ...st.runs, [run.id]: run },
        streamingRunIds: [...st.streamingRunIds, run.id],
      }));
      let buffer = "";
      let lastFlush = Date.now();
      try {
        const adapter = globalRegistry.get(gen.adapterId);
        for await (const event of adapter.streamText({
          providerId: gen.providerId,
          modelId: gen.modelId,
          role: "prose_drafter",
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
              patchSectionDraft(set, manuscriptId, sectionId, buffer);
            }
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
        patchSectionDraft(set, manuscriptId, sectionId, buffer.trim());
        const provenance: PassageProvenance = {
          manuscriptId,
          passageId: sectionId,
          nodeIds: manifest.includedNodeIds,
          excerptIds: [],
          modelRunId: run.id,
        };
        set((st) => {
          const current = st.runs[run.id];
          if (!current) return {};
          return {
            passages: { ...st.passages, [`${manuscriptId}:${sectionId}`]: provenance },
            runs: {
              ...st.runs,
              [run.id]: {
                ...current,
                status: "completed",
                completedAt: new Date().toISOString(),
                inputTokens: manifest.estimatedTokens,
                outputTokens: estimateTokens(buffer),
              },
            },
          };
        });
      } catch (error) {
        set((st) => {
          const current = st.runs[run.id];
          if (!current) return {};
          return {
            runs: { ...st.runs, [run.id]: { ...current, status: "failed", error: (error as Error).message } },
          };
        });
        get().showToast(`Drafting failed: ${(error as Error).message}`);
      } finally {
        runControllers.delete(run.id);
        set((st) => ({ streamingRunIds: st.streamingRunIds.filter((x) => x !== run.id) }));
      }
    },
  };
}

function patchSectionDraft(
  set: SetFn,
  manuscriptId: ManuscriptId,
  sectionId: string,
  draft: string
): void {
  set((st) => {
    const manuscript = st.manuscripts[manuscriptId];
    if (!manuscript) return {};
    const outline = manuscript.outline.map((sec) =>
      sec.id === sectionId ? { ...sec, draft } : sec
    );
    return {
      manuscripts: {
        ...st.manuscripts,
        [manuscriptId]: { ...manuscript, outline },
      },
    };
  });
}
