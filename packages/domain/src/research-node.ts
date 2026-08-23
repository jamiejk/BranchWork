import { z } from "zod";
import { newNodeId } from "./ids";
import { authorKindSchema, nodeStatusSchema, nodeTypeSchema } from "./node-types";
import { positionSchema, sizeSchema } from "./position";
import type { AuthorKind, NodeStatus, NodeType } from "./node-types";
import type { NodeId, ProjectId } from "./ids";

const isoTimestamp = z.string().min(1);

export const researchNodeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  type: nodeTypeSchema,
  title: z.string().default(""),
  content: z.string().default(""),
  plainText: z.string().default(""),
  position: positionSchema.default({ x: 0, y: 0 }),
  size: sizeSchema.optional(),
  status: nodeStatusSchema.default("draft"),
  authorKind: authorKindSchema.default("human"),
  authorId: z.string().optional(),
  modelRunId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});

export type ResearchNode = z.infer<typeof researchNodeSchema>;

export function derivePlainText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1 ($2)")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

export interface CreateResearchNodeInput {
  projectId: ProjectId;
  type: NodeType;
  id?: NodeId;
  title?: string;
  content?: string;
  plainText?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  status?: NodeStatus;
  authorKind?: AuthorKind;
  authorId?: string;
  modelRunId?: string;
  tags?: string[];
}

export function createResearchNode(input: CreateResearchNodeInput): ResearchNode {
  const now = new Date().toISOString();
  return researchNodeSchema.parse({
    id: input.id ?? newNodeId(),
    projectId: input.projectId,
    type: input.type,
    title: input.title ?? "",
    content: input.content ?? "",
    plainText: input.plainText ?? derivePlainText(input.content ?? ""),
    position: input.position ?? { x: 0, y: 0 },
    size: input.size,
    status: input.status ?? "draft",
    authorKind: input.authorKind ?? "human",
    ...(input.authorId ? { authorId: input.authorId } : {}),
    ...(input.modelRunId ? { modelRunId: input.modelRunId } : {}),
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  });
}

export interface ResearchNodePatch {
  type?: NodeType;
  title?: string;
  content?: string;
  plainText?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  status?: NodeStatus;
  tags?: string[];
}

export function updateResearchNode(node: ResearchNode, patch: ResearchNodePatch): ResearchNode {
  const next = {
    ...node,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (patch.content !== undefined && patch.plainText === undefined) {
    next.plainText = derivePlainText(patch.content);
  }
  return researchNodeSchema.parse(next);
}
