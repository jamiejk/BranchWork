import { z } from "zod";
import { newModelRunId } from "./ids";
import type { ModelRunId, NodeId, ProjectId, ProviderId } from "./ids";

const isoTimestamp = z.string().min(1);

export const MODEL_ROLES = [
  "quick_explore",
  "deep_explore",
  "source_analyst",
  "outline_builder",
  "prose_drafter",
  "critic",
  "citation_checker",
  "copy_editor",
] as const;

export type ModelRole = (typeof MODEL_ROLES)[number];

export const modelRoleSchema = z.enum(MODEL_ROLES);

export const MODEL_ROLE_LABELS: Record<ModelRole, string> = {
  quick_explore: "Quick explore",
  deep_explore: "Deep explore",
  source_analyst: "Source analyst",
  outline_builder: "Outline builder",
  prose_drafter: "Prose drafter",
  critic: "Critic",
  citation_checker: "Citation checker",
  copy_editor: "Copy editor",
};

export const MODEL_RUN_STATUSES = [
  "queued",
  "streaming",
  "completed",
  "failed",
  "cancelled",
] as const;

export type ModelRunStatus = (typeof MODEL_RUN_STATUSES)[number];

export const modelRunStatusSchema = z.enum(MODEL_RUN_STATUSES);

export const modelRunSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  role: modelRoleSchema,
  promptTemplateId: z.string().optional(),
  systemInstructions: z.string().default(""),
  userPrompt: z.string().default(""),
  contextNodeIds: z.array(z.string()).default([]),
  sourceExcerptIds: z.array(z.string()).default([]),
  parameters: z.record(z.unknown()).default({}),
  inputTokens: z.number().int().optional(),
  outputTokens: z.number().int().optional(),
  estimatedCost: z.number().optional(),
  status: modelRunStatusSchema.default("queued"),
  createdAt: isoTimestamp,
  completedAt: isoTimestamp.optional(),
  error: z.string().optional(),
});

export type ModelRun = z.infer<typeof modelRunSchema>;

export interface CreateModelRunInput {
  projectId: ProjectId;
  providerId: ProviderId;
  modelId: string;
  role: ModelRole;
  systemInstructions?: string;
  userPrompt?: string;
  contextNodeIds?: NodeId[];
  sourceExcerptIds?: string[];
  parameters?: Record<string, unknown>;
  status?: ModelRunStatus;
}

export function createModelRun(input: CreateModelRunInput): ModelRun {
  return modelRunSchema.parse({
    id: newModelRunId(),
    projectId: input.projectId,
    providerId: input.providerId,
    modelId: input.modelId,
    role: input.role,
    systemInstructions: input.systemInstructions ?? "",
    userPrompt: input.userPrompt ?? "",
    contextNodeIds: input.contextNodeIds ?? [],
    sourceExcerptIds: input.sourceExcerptIds ?? [],
    parameters: input.parameters ?? {},
    status: input.status ?? "queued",
    createdAt: new Date().toISOString(),
  });
}
