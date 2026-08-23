import { z } from "zod";
import { newExcerptId, newSourceId } from "./ids";
import type { ExcerptId, NodeId, SourceId, ProjectId } from "./ids";

const isoTimestamp = z.string().min(1);

export const SOURCE_KINDS = ["web", "pdf", "book", "paper", "audio", "video", "other"] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export const sourceKindSchema = z.enum(SOURCE_KINDS);

export const sourceRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  kind: sourceKindSchema,
  title: z.string().default(""),
  authors: z.array(z.string()).default([]),
  url: z.string().optional(),
  publisher: z.string().optional(),
  publishedAt: z.string().optional(),
  retrievedAt: z.string().optional(),
  fileObjectKey: z.string().optional(),
  canonicalText: z.string().optional(),
  checksum: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type SourceRecord = z.infer<typeof sourceRecordSchema>;

export interface CreateSourceRecordInput {
  projectId: ProjectId;
  kind: SourceKind;
  id?: SourceId;
  title?: string;
  authors?: string[];
  url?: string;
  publisher?: string;
  publishedAt?: string;
  canonicalText?: string;
  metadata?: Record<string, unknown>;
}

export function createSourceRecord(input: CreateSourceRecordInput): SourceRecord {
  return sourceRecordSchema.parse({
    id: input.id ?? newSourceId(),
    projectId: input.projectId,
    kind: input.kind,
    title: input.title ?? "",
    authors: input.authors ?? [],
    ...(input.url ? { url: input.url } : {}),
    ...(input.publisher ? { publisher: input.publisher } : {}),
    ...(input.publishedAt ? { publishedAt: input.publishedAt } : {}),
    retrievedAt: new Date().toISOString(),
    ...(input.canonicalText
      ? { canonicalText: input.canonicalText, checksum: simpleChecksum(input.canonicalText) }
      : {}),
    metadata: input.metadata ?? {},
  });
}

export function simpleChecksum(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const sourceExcerptSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  nodeId: z.string().optional(),
  quote: z.string().min(1),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
  locator: z.string().optional(),
  annotation: z.string().optional(),
});

export type SourceExcerpt = z.infer<typeof sourceExcerptSchema>;

export interface CreateSourceExcerptInput {
  sourceId: SourceId;
  quote: string;
  id?: ExcerptId;
  nodeId?: NodeId;
  prefix?: string;
  suffix?: string;
  pageNumber?: number;
  locator?: string;
  annotation?: string;
}

export function createSourceExcerpt(input: CreateSourceExcerptInput): SourceExcerpt {
  return sourceExcerptSchema.parse({
    id: input.id ?? newExcerptId(),
    sourceId: input.sourceId,
    ...(input.nodeId ? { nodeId: input.nodeId } : {}),
    quote: input.quote,
    ...(input.prefix ? { prefix: input.prefix } : {}),
    ...(input.suffix ? { suffix: input.suffix } : {}),
    ...(input.pageNumber ? { pageNumber: input.pageNumber } : {}),
    ...(input.locator ? { locator: input.locator } : {}),
    ...(input.annotation ? { annotation: input.annotation } : {}),
  });
}
