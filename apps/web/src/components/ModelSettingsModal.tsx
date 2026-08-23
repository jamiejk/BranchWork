"use client";

import { useState } from "react";
import { useStore } from "../state/store";
import {
  guessFromModelId,
  isGenericProviderLabel,
  isGuessedEndpoint,
  newModelId,
  newProviderId,
  type ModelSettings,
} from "../state/modelSettings";

const EFFORTS = ["low", "medium", "high"] as const;

export function ModelSettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.modelSettings);
  const update = useStore((s) => s.updateModelSettings);

  const patchProvider = (providerId: string, patch: Partial<{ label: string; baseURL: string; apiKey: string }>) =>
    update({
      ...settings,
      providers: settings.providers.map((p) => (p.id === providerId ? { ...p, ...patch } : p)),
    });

  const onModelNameChange = (modelRecordId: string, modelId: string) => {
    const model = settings.models.find((m) => m.id === modelRecordId);
    if (!model) return;
    const guess = guessFromModelId(modelId);
    const provider = settings.providers.find((p) => p.id === model.providerId);
    // auto-fill provider details only while they still hold our guesses
    const autoFill =
      provider && isGenericProviderLabel(provider.label) && isGuessedEndpoint(provider.baseURL);
    update({
      ...settings,
      providers: autoFill
        ? settings.providers.map((p) =>
            p.id === model.providerId ? { ...p, label: guess.providerLabel, baseURL: guess.baseURL } : p
          )
        : settings.providers,
      models: settings.models.map((m) => (m.id === modelRecordId ? { ...m, modelId } : m)),
    });
  };

  const removeModel = (modelRecordId: string) => {
    const models = settings.models.filter((m) => m.id !== modelRecordId);
    const inUse = new Set(models.map((m) => m.providerId));
    update({
      providers: settings.providers.filter((p) => inUse.has(p.id)),
      models,
      activeModelId:
        settings.activeModelId && models.some((m) => m.id === settings.activeModelId)
          ? settings.activeModelId
          : (models[0]?.id ?? null),
    });
  };

  const addModel = () => {
    const guess = guessFromModelId("");
    const providerId = newProviderId();
    const modelRecordId = newModelId();
    update({
      providers: [
        ...settings.providers,
        { id: providerId, label: "", baseURL: "", apiKey: "" },
      ],
      models: [
        ...settings.models,
        { id: modelRecordId, providerId, modelId: "", effort: guess.effort },
      ],
      activeModelId: settings.activeModelId ?? modelRecordId,
    });
  };

  return (
    <div
      className="bw-modal-backdrop"
      onClick={onClose}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="bw-modal bw-modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="bw-modal-header">
          <h2>Models</h2>
          <button className="bw-mini-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </header>
        <p className="bw-modal-sub">
          Keys and endpoints are stored only in this browser. Provider and endpoint are guessed from the model name — override them freely.
        </p>

        <div className="bw-field" style={{ marginTop: 10 }}>
          <label className="bw-field">
            Background tasks (source &amp; entity extraction)
            <select
              value={settings.extractionModelId ?? ""}
              onChange={(e) =>
                update({ ...settings, extractionModelId: e.target.value || null })
              }
            >
              <option value="">Same as main model</option>
              {settings.models.map((m) => {
                const provider = settings.providers.find((p) => p.id === m.providerId);
                return (
                  <option key={m.id} value={m.id}>
                    {(provider?.label || "Custom") + " · " + (m.modelId || "unnamed")}
                  </option>
                );
              })}
            </select>
          </label>
          <p className="bw-muted">
            Tip: point this at a small local model (e.g. Gemma/Gemini via Ollama) — extraction runs often and cheap is fine.
          </p>
        </div>

        {settings.models.length === 0 && (
          <p className="bw-muted">No models configured yet — add one below.</p>
        )}

        <div className="bw-model-rows">
          {settings.models.map((model) => {
            const provider = settings.providers.find((p) => p.id === model.providerId);
            return (
              <div key={model.id} className="bw-model-row">
                <div className="bw-model-row-head">
                  <label className="bw-field bw-field-grow">
                    Provider name
                    <input
                      value={provider?.label ?? ""}
                      placeholder="xAI, OpenAI, local relay…"
                      onChange={(e) =>
                        provider && patchProvider(provider.id, { label: e.target.value })
                      }
                    />
                  </label>
                  <label className="bw-field bw-field-grow">
                    Model name
                    <input
                      value={model.modelId}
                      placeholder="grok-4.6"
                      onChange={(e) => onModelNameChange(model.id, e.target.value)}
                    />
                  </label>
                  <label className="bw-field">
                    Effort
                    <select
                      value={model.effort}
                      onChange={(e) =>
                        update({
                          ...settings,
                          models: settings.models.map((m) =>
                            m.id === model.id ? { ...m, effort: e.target.value as "low" | "medium" | "high" } : m
                          ),
                        })
                      }
                    >
                      {EFFORTS.map((effort) => (
                        <option key={effort} value={effort}>
                          {effort}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="bw-mini-btn"
                    title="Remove this model"
                    onClick={() => removeModel(model.id)}
                  >
                    ✕
                  </button>
                </div>

                {provider && (
                  <div className="bw-model-row-creds">
                    <label className="bw-field bw-field-grow">
                      API endpoint
                      <input
                        value={provider.baseURL}
                        placeholder="https://…/v1"
                        onChange={(e) => patchProvider(provider.id, { baseURL: e.target.value })}
                      />
                    </label>
                    <label className="bw-field bw-field-grow">
                      API key
                      <input
                        type="password"
                        value={provider.apiKey}
                        placeholder="sk-…"
                        autoComplete="off"
                        onChange={(e) => patchProvider(provider.id, { apiKey: e.target.value })}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <footer className="bw-modal-footer">
          <button className="btn btn-small" onClick={addModel}>
            ＋ Add model
          </button>
          <span className="bw-spacer" />
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

export function useModelSettingsOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  return [open, setOpen];
}

export type { ModelSettings };
