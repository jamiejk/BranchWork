import type { ModelRole } from "@branchwork/domain";

export interface RolePreset {
  role: ModelRole;
  label: string;
  job: string;
  defaultModelId: string;
  systemInstructions: string;
}

export const ROLE_PRESETS: Record<ModelRole, RolePreset> = {
  quick_explore: {
    role: "quick_explore",
    label: "Quick explore",
    job: "Fast branches, titles, tags, short summaries",
    defaultModelId: "mock-fast",
    systemInstructions:
      "You are a research assistant. Explore the question concisely, surfacing distinct angles as short labelled points.",
  },
  deep_explore: {
    role: "deep_explore",
    label: "Deep explore",
    job: "Thorough explanation or multi-step reasoning",
    defaultModelId: "mock-deep",
    systemInstructions:
      "You are a careful research analyst. Reason through the question thoroughly and surface assumptions, alternatives, and open subquestions.",
  },
  source_analyst: {
    role: "source_analyst",
    label: "Source analyst",
    job: "Extract claims, evidence, caveats, and quotations",
    defaultModelId: "mock-deep",
    systemInstructions:
      "You extract claims, evidence, caveats, and exact quotations from provided source material. Never invent quotations.",
  },
  outline_builder: {
    role: "outline_builder",
    label: "Outline builder",
    job: "Cluster selected nodes into an argument structure",
    defaultModelId: "mock-deep",
    systemInstructions:
      "You organise research notes into an essay outline. Use only the supplied node ids.",
  },
  prose_drafter: {
    role: "prose_drafter",
    label: "Prose drafter",
    job: "Write a section from approved research material",
    defaultModelId: "mock-prose",
    systemInstructions:
      "You draft clear academic prose strictly from the approved research material. Cite supplied excerpt ids inline where used.",
  },
  critic: {
    role: "critic",
    label: "Critic",
    job: "Identify gaps, contradictions, repetition, weak reasoning",
    defaultModelId: "mock-deep",
    systemInstructions:
      "You are an adversarial but constructive reviewer. Identify gaps, contradictions, and unsupported claims.",
  },
  citation_checker: {
    role: "citation_checker",
    label: "Citation checker",
    job: "Compare claims with cited excerpts",
    defaultModelId: "mock-deep",
    systemInstructions:
      "You verify that each claim is genuinely supported by its cited excerpts. Flag mismatches explicitly.",
  },
  copy_editor: {
    role: "copy_editor",
    label: "Copy editor",
    job: "Improve prose without changing substantive claims",
    defaultModelId: "mock-prose",
    systemInstructions:
      "You improve clarity and style without changing meaning or substantive claims.",
  },
};

export const MODEL_ROLE_ORDER: ModelRole[] = [
  "quick_explore",
  "deep_explore",
  "source_analyst",
  "outline_builder",
  "prose_drafter",
  "critic",
  "citation_checker",
  "copy_editor",
];
