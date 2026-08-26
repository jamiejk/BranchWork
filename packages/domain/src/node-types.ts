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
  "person",
  "entity",
  "summary",
  "section_idea",
  "draft_fragment",
  "task",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const nodeTypeSchema = z.enum(NODE_TYPES);

/**
 * User-defined card types, stored per-project. The id is a slug derived from
 * the label; cards reference it as `custom:<id>`.
 */
export const customCardTypeSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  label: z.string().min(1).max(60),
  hint: z.string().max(120).default(""),
});

export type CustomCardType = z.infer<typeof customCardTypeSchema>;

export const NODE_STATUSES = ["draft", "reviewed", "verified", "disputed", "excluded"] as const;

export type NodeStatus = (typeof NODE_STATUSES)[number];

export const nodeStatusSchema = z.enum(NODE_STATUSES);

export const AUTHOR_KINDS = ["human", "model", "import"] as const;

export type AuthorKind = (typeof AUTHOR_KINDS)[number];

export const authorKindSchema = z.enum(AUTHOR_KINDS);

/** Prefix identifying a card type as project-defined: `custom:<id>`. */
export const CUSTOM_TYPE_PREFIX = "custom:";

export function isCustomTypeId(type: string): boolean {
  return type.startsWith(CUSTOM_TYPE_PREFIX);
}

export function customTypeId(id: string): string {
  return `${CUSTOM_TYPE_PREFIX}${id}`;
}

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
  person: { label: "Person", hint: "A real or fictional individual" },
  entity: { label: "Entity", hint: "A named thing — book, film, organisation, event, place" },
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

/** Display metadata for any card type, built-in or project-custom. */
export function cardTypeMeta(
  type: string,
  customTypes: CustomCardType[] = []
): NodeTypeMeta {
  if (!isCustomTypeId(type)) {
    return (
      NODE_TYPE_REGISTRY[type as NodeType] ?? { label: type, hint: "" }
    );
  }
  const id = type.slice(CUSTOM_TYPE_PREFIX.length);
  const found = customTypes.find((c) => c.id === id);
  return found
    ? { label: found.label, hint: found.hint }
    : { label: id, hint: "" };
}

/** Slugify a user-typed label into a valid custom-type id. */
export function slugifyTypeLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "type"
  );
}

// ---------------------------------------------------------------------------
// Validation against a project's custom types.
//
// Cards may carry either a built-in type or `custom:<id>` for an id declared
// in the same bundle's project.customCardTypes. `nodeTypeSchema` alone still
// validates built-ins (legacy callers); use this when the custom list is known.
// ---------------------------------------------------------------------------

const rawCardTypeSchema = z
  .string()
  .refine(
    (t) => nodeTypeSchema.safeParse(t).success || isCustomTypeId(t),
    { message: "unknown card type" }
  );

export function validateCardType(
  type: string,
  customTypes: CustomCardType[]
): boolean {
  if (!isCustomTypeId(type)) return nodeTypeSchema.safeParse(type).success;
  const id = type.slice(CUSTOM_TYPE_PREFIX.length);
  return customTypes.some((c) => c.id === id);
}

export { rawCardTypeSchema };
