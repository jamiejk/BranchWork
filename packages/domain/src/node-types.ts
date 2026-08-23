import { z } from "zod";

export const NODE_TYPES = [
  "question",
  "note",
  "exploration",
  "source",
  "excerpt",
  "claim",
  "counterclaim",
  "evidence",
  "example",
  "concept",
  "summary",
  "section_idea",
  "draft_fragment",
  "task",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const nodeTypeSchema = z.enum(NODE_TYPES);

export const NODE_STATUSES = ["draft", "reviewed", "verified", "disputed", "excluded"] as const;

export type NodeStatus = (typeof NODE_STATUSES)[number];

export const nodeStatusSchema = z.enum(NODE_STATUSES);

export const AUTHOR_KINDS = ["human", "model", "import"] as const;

export type AuthorKind = (typeof AUTHOR_KINDS)[number];

export const authorKindSchema = z.enum(AUTHOR_KINDS);

export interface NodeTypeMeta {
  label: string;
  hint: string;
}

export const NODE_TYPE_REGISTRY: Record<NodeType, NodeTypeMeta> = {
  question: { label: "Question", hint: "A research question or follow-up question" },
  note: { label: "Note", hint: "Original user-authored thinking" },
  exploration: { label: "Exploration", hint: "An AI-generated explanation or investigation" },
  source: { label: "Source", hint: "A URL, document, book, paper, interview, or media item" },
  excerpt: { label: "Excerpt", hint: "An exact quotation or bounded passage from a source" },
  claim: { label: "Claim", hint: "A proposition intended to be argued or assessed" },
  counterclaim: { label: "Counterclaim", hint: "An objection or opposing proposition" },
  evidence: { label: "Evidence", hint: "An observation offered in support of a claim" },
  example: { label: "Example", hint: "A concrete illustration or case" },
  concept: { label: "Concept", hint: "A definition or reusable concept" },
  summary: { label: "Summary", hint: "A summary of a branch or group" },
  section_idea: { label: "Section idea", hint: "A possible part of a manuscript outline" },
  draft_fragment: { label: "Draft fragment", hint: "Prose that might be reused in a manuscript" },
  task: { label: "Task", hint: "An unresolved research or editorial action" },
};

export const NODE_STATUS_META: Record<NodeStatus, { label: string }> = {
  draft: { label: "Draft" },
  reviewed: { label: "Reviewed" },
  verified: { label: "Verified" },
  disputed: { label: "Disputed" },
  excluded: { label: "Excluded" },
};
