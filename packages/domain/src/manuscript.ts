import { z } from "zod";
import { newManuscriptId } from "./ids";
import type { ManuscriptId, NodeId, ProjectId } from "./ids";

const isoTimestamp = z.string().min(1);

export interface OutlineSection {
  id: string;
  heading: string;
  order: number;
  purpose?: string;
  nodeRefs: NodeId[];
  children: OutlineSection[];
  draft?: string;
}

export const outlineSectionSchema: z.ZodType<OutlineSection, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    heading: z.string().default(""),
    order: z.number().int(),
    purpose: z.string().optional(),
    nodeRefs: z.array(z.string()).default([]),
    children: z.array(outlineSectionSchema).default([]),
    draft: z.string().optional(),
  })
);

export const manuscriptSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().default("Untitled manuscript"),
  content: z.string().default(""),
  outline: z.array(outlineSectionSchema).default([]),
  citationStyle: z.string().default("basic-footnotes"),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});

export type Manuscript = z.infer<typeof manuscriptSchema>;

export function createManuscript(input: {
  projectId: ProjectId;
  title?: string;
  id?: ManuscriptId;
}): Manuscript {
  const now = new Date().toISOString();
  return manuscriptSchema.parse({
    id: input.id ?? newManuscriptId(),
    projectId: input.projectId,
    title: input.title ?? "Untitled manuscript",
    content: "",
    outline: [],
    createdAt: now,
    updatedAt: now,
  });
}

export interface PassageProvenance {
  manuscriptId: ManuscriptId;
  passageId: string;
  nodeIds: NodeId[];
  excerptIds: string[];
  modelRunId?: string;
}

export const passageProvenanceSchema = z.object({
  manuscriptId: z.string().min(1),
  passageId: z.string().min(1),
  nodeIds: z.array(z.string()),
  excerptIds: z.array(z.string()),
  modelRunId: z.string().optional(),
});
