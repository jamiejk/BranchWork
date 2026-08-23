"use client";

// Model/provider configuration lives entirely in this browser's localStorage.
// API keys are never written into the repository or sent anywhere except to
// the provider endpoint the user configures.

import type { EndpointConfig } from "@branchwork/models";

const STORAGE_KEY = "branchwork.models.v1";

export type Effort = "low" | "medium" | "high";

export interface ProviderRecord {
  id: string;
  label: string;
  baseURL: string;
  apiKey: string;
}

export interface ModelRecord {
  id: string;
  providerId: string;
  modelId: string;
  effort: Effort;
}

export interface ModelSettings {
  providers: ProviderRecord[];
  models: ModelRecord[];
  activeModelId: string | null;
  /** Model used for background tasks (source/entity extraction); null = same as main */
  extractionModelId?: string | null;
}

export const EMPTY_SETTINGS: ModelSettings = {
  providers: [],
  models: [],
  activeModelId: null,
  extractionModelId: null,
};

interface KnownFamily {
  match: RegExp;
  providerLabel: string;
  baseURL: string;
  defaultEffort: Effort;
}

// Best-effort guesses; every field stays user-editable.
const KNOWN_FAMILIES: KnownFamily[] = [
  { match: /grok/i, providerLabel: "xAI", baseURL: "https://api.x.ai/v1", defaultEffort: "high" },
  { match: /^(o[134](-|$))|gpt-|^chatgpt/i, providerLabel: "OpenAI", baseURL: "https://api.openai.com/v1", defaultEffort: "medium" },
  { match: /gemini|flash|thinking/i, providerLabel: "Google AI", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", defaultEffort: "medium" },
  { match: /deepseek/i, providerLabel: "DeepSeek", baseURL: "https://api.deepseek.com/v1", defaultEffort: "medium" },
  { match: /mistral|magistral|ministral/i, providerLabel: "Mistral", baseURL: "https://api.mistral.ai/v1", defaultEffort: "low" },
  { match: /llama|qwen|phi-|hermes/i, providerLabel: "Local (Ollama)", baseURL: "http://localhost:11434/v1", defaultEffort: "medium" },
];

export function guessFromModelId(modelId: string): {
  providerLabel: string;
  baseURL: string;
  effort: Effort;
} {
  const family = KNOWN_FAMILIES.find((f) => f.match.test(modelId));
  if (family) {
    return { providerLabel: family.providerLabel, baseURL: family.baseURL, effort: family.defaultEffort };
  }
  return { providerLabel: "Custom provider", baseURL: "", effort: "medium" };
}

export function isGenericProviderLabel(label: string): boolean {
  return label.trim() === "" || label.trim() === "Custom provider";
}

/** True when the endpoint equals one of our guesses, i.e. the user has not customized it yet. */
export function isGuessedEndpoint(baseURL: string): boolean {
  return baseURL.trim() === "" || KNOWN_FAMILIES.some((f) => f.baseURL === baseURL.trim());
}

export function loadModelSettings(): ModelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<ModelSettings>;
    return {
      providers: Array.isArray(parsed.providers) ? parsed.providers : [],
      models: Array.isArray(parsed.models) ? parsed.models : [],
      activeModelId:
        typeof parsed.activeModelId === "string" ? parsed.activeModelId : parsed.models?.[0]?.id ?? null,
      extractionModelId:
        typeof parsed.extractionModelId === "string" ? parsed.extractionModelId : null,
    };
  } catch {
    return structuredClone(EMPTY_SETTINGS);
  }
}

export function saveModelSettings(settings: ModelSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode); settings stay in memory for the session
  }
}

export function resolveEndpoint(settings: ModelSettings, providerId: string): EndpointConfig | null {
  const provider = settings.providers.find((p) => p.id === providerId);
  if (!provider) return null;
  return { baseURL: provider.baseURL, apiKey: provider.apiKey };
}

export function newProviderId(): string {
  return `prov_${crypto.randomUUID().slice(0, 8)}`;
}

export function newModelId(): string {
  return `mdl_${crypto.randomUUID().slice(0, 8)}`;
}
