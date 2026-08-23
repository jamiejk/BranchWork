"use client";

import { globalRegistry, OpenAiCompatAdapter } from "@branchwork/models";
import { resolveEndpoint, type ModelSettings } from "./modelSettings";

export const OPENAI_COMPAT_ID = "openai-compat";
export const MOCK_PROVIDER_ID = "mock";

export interface ActiveGeneration {
  adapterId: string;
  providerId: string;
  modelId: string;
  reasoningEffort?: string;
}

/** The user-configured model to use for generations, or null to fall back to the mock. */
export function activeGeneration(settings: ModelSettings): ActiveGeneration | null {
  const model = settings.models.find((m) => m.id === settings.activeModelId);
  if (!model) return null;
  const provider = settings.providers.find((p) => p.id === model.providerId);
  if (!provider || !provider.baseURL || !provider.apiKey) return null;
  return {
    adapterId: OPENAI_COMPAT_ID,
    providerId: model.providerId,
    modelId: model.modelId,
    reasoningEffort: model.effort,
  };
}

/**
 * Registers the OpenAI-compatible adapter. The endpoint resolver reads the
 * store lazily at request time, so credentials stay in localStorage only.
 * Call once during store creation.
 */
export function registerGenerationAdapter(
  getSettings: () => ModelSettings
): void {
  try {
    if (globalRegistry.get(OPENAI_COMPAT_ID)) return;
  } catch {
    // not registered yet — fall through and register
  }
  globalRegistry.register(
    new OpenAiCompatAdapter(OPENAI_COMPAT_ID, "OpenAI-compatible", (providerId) =>
      resolveEndpoint(getSettings(), providerId)
    )
  );
}

/** Adapter + ids for a generation, falling back to the offline mock. */
export function resolveAdapter(
  settings: ModelSettings,
  fallbackModelId: string
): { adapterId: string; providerId: string; modelId: string; reasoningEffort?: string } {
  const active = activeGeneration(settings);
  return {
    adapterId: active?.adapterId ?? MOCK_PROVIDER_ID,
    providerId: active?.providerId ?? MOCK_PROVIDER_ID,
    modelId: active?.modelId ?? fallbackModelId,
    ...(active?.reasoningEffort ? { reasoningEffort: active.reasoningEffort } : {}),
  };
}

/**
 * Model for background tasks (source/entity extraction). Prefers the
 * dedicated extraction model (often a small local one), else the main model.
 */
export function resolveExtraction(settings: ModelSettings): ActiveGeneration | null {
  if (settings.extractionModelId) {
    const model = settings.models.find((m) => m.id === settings.extractionModelId);
    const provider = model && settings.providers.find((p) => p.id === model.providerId);
    if (model && provider?.baseURL && provider.apiKey) {
      return {
        adapterId: OPENAI_COMPAT_ID,
        providerId: model.providerId,
        modelId: model.modelId,
      };
    }
  }
  return activeGeneration(settings);
}
