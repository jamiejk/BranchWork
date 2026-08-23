import { z } from "zod";
import { projectSchema } from "./project";
import { researchEdgeSchema } from "./research-edge";
import { researchNodeSchema } from "./research-node";
import { sourceExcerptSchema, sourceRecordSchema } from "./sources";
import { manuscriptSchema, passageProvenanceSchema } from "./manuscript";
import { modelRunSchema } from "./model-run";
import type { Project } from "./project";
import type { ResearchEdge } from "./research-edge";
import type { ResearchNode } from "./research-node";
import type { SourceExcerpt, SourceRecord } from "./sources";
import type { Manuscript, PassageProvenance } from "./manuscript";
import type { ModelRun } from "./model-run";

export const EXPORT_FORMAT = "branchwork/project";
export const EXPORT_FORMAT_VERSION = 1;

export const branchworkExportFileSchema = z.object({
  format: z.literal(EXPORT_FORMAT).default(EXPORT_FORMAT),
  formatVersion: z.literal(1).default(1),
  exportedAt: z.string().min(1).optional(),
  project: projectSchema,
  nodes: z.array(researchNodeSchema).default([]),
  edges: z.array(researchEdgeSchema).default([]),
  sources: z.array(sourceRecordSchema).default([]),
  excerpts: z.array(sourceExcerptSchema).default([]),
  manuscripts: z.array(manuscriptSchema).default([]),
  passages: z.array(passageProvenanceSchema).default([]),
  modelRuns: z.array(modelRunSchema).default([]),
});

export type BranchworkExportFile = z.infer<typeof branchworkExportFileSchema>;

export interface ExportBundleInput {
  project: Project;
  nodes: ResearchNode[];
  edges: ResearchEdge[];
  sources?: SourceRecord[];
  excerpts?: SourceExcerpt[];
  manuscripts?: Manuscript[];
  passages?: PassageProvenance[];
  modelRuns?: ModelRun[];
}

export function createExportBundle(input: ExportBundleInput): BranchworkExportFile {
  return branchworkExportFileSchema.parse({
    exportedAt: new Date().toISOString(),
    project: input.project,
    nodes: input.nodes,
    edges: input.edges,
    sources: input.sources ?? [],
    excerpts: input.excerpts ?? [],
    manuscripts: input.manuscripts ?? [],
    passages: input.passages ?? [],
    modelRuns: input.modelRuns ?? [],
  });
}
