import { z } from "zod";
import { newEdgeId } from "./ids";
import { edgeCreatorSchema, edgeTypeSchema } from "./edge-types";
import type { EdgeCreator, EdgeType } from "./edge-types";
import type { EdgeId, NodeId, ProjectId } from "./ids";

const isoTimestamp = z.string().min(1);

export const researchEdgeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  type: edgeTypeSchema,
  label: z.string().optional(),
  /** which handle the edge leaves from ("s-bottom" | "s-right"), when user-drawn */
  sourceHandle: z.string().optional(),
  /** which handle the edge enters ("t-top" | "t-left"), when user-drawn */
  targetHandle: z.string().optional(),
  createdBy: edgeCreatorSchema.default("human"),
  createdAt: isoTimestamp,
});

export type ResearchEdge = z.infer<typeof researchEdgeSchema>;

export interface CreateResearchEdgeInput {
  projectId: ProjectId;
  sourceNodeId: NodeId;
  targetNodeId: NodeId;
  type: EdgeType;
  label?: string;
  sourceHandle?: string;
  targetHandle?: string;
  createdBy?: EdgeCreator;
  id?: EdgeId;
}

export function createResearchEdge(input: CreateResearchEdgeInput): ResearchEdge {
  return researchEdgeSchema.parse({
    id: input.id ?? newEdgeId(),
    projectId: input.projectId,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    type: input.type,
    ...(input.label ? { label: input.label } : {}),
    ...(input.sourceHandle ? { sourceHandle: input.sourceHandle } : {}),
    ...(input.targetHandle ? { targetHandle: input.targetHandle } : {}),
    createdBy: input.createdBy ?? "human",
    createdAt: new Date().toISOString(),
  });
}
