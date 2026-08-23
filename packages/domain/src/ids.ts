export type ProjectId = string;
export type NodeId = string;
export type EdgeId = string;
export type SourceId = string;
export type ExcerptId = string;
export type ManuscriptId = string;
export type ModelRunId = string;
export type ProviderId = string;

function randomId(): string {
  const uuid =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return uuid.replace(/-/g, "").slice(0, 20);
}

export function newId(prefix: string): string {
  return `${prefix}_${randomId()}`;
}

export const newNodeId = (): NodeId => newId("n");
export const newEdgeId = (): EdgeId => newId("e");
export const newProjectId = (): ProjectId => newId("p");
export const newSourceId = (): SourceId => newId("s");
export const newExcerptId = (): ExcerptId => newId("x");
export const newManuscriptId = (): ManuscriptId => newId("m");
export const newModelRunId = (): ModelRunId => newId("r");
