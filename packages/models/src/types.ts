import type { ModelRole } from "@branchwork/domain";

export interface ModelCapabilities {
  streaming: boolean;
  structuredOutput: boolean;
  toolCalling: boolean;
  imageInput: boolean;
  pdfInput: boolean;
  embeddings: boolean;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export type ModelEvent =
  | { type: "delta"; text: string }
  | { type: "done"; finishReason: string }
  | { type: "error"; message: string };

export interface TextGenerationRequest {
  providerId: string;
  modelId: string;
  role?: ModelRole;
  system?: string;
  prompt: string;
  contextText?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Best-effort reasoning effort signal ("low" | "medium" | "high"); ignored by models without it */
  reasoningEffort?: string;
  signal?: AbortSignal;
}

export interface StructuredGenerationRequest<T> {
  providerId: string;
  modelId: string;
  role?: ModelRole;
  system?: string;
  prompt: string;
  contextText?: string;
  kind: string;
  payload?: unknown;
  signal?: AbortSignal;
  parse: (raw: unknown) => T;
}

export interface BranchworkModelAdapter {
  id: string;
  label: string;
  listModels(): ModelInfo[];
  capabilities(modelId: string): ModelCapabilities;
  streamText(request: TextGenerationRequest): AsyncIterable<ModelEvent>;
  generateObject<T>(request: StructuredGenerationRequest<T>): Promise<T>;
}
