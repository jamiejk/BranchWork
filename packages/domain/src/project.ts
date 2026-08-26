import { z } from "zod";
import { newProjectId } from "./ids";
import { customCardTypeSchema } from "./node-types";
import type { NodeId, ProjectId } from "./ids";

const isoTimestamp = z.string().min(1);

export const projectSchema = z.object({
  id: z.string().min(1),
  title: z.string().default("Untitled project"),
  rootNodeId: z.string().optional(),
  customCardTypes: z.array(customCardTypeSchema).default([]),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});

export type Project = z.infer<typeof projectSchema>;

export function createProject(input: { title?: string; id?: ProjectId }): Project {
  const now = new Date().toISOString();
  return projectSchema.parse({
    id: input.id ?? newProjectId(),
    title: input.title ?? "Untitled project",
    createdAt: now,
    updatedAt: now,
  });
}
