import type { BranchworkModelAdapter, ModelInfo } from "./types";

export class ProviderRegistry {
  private providers = new Map<string, BranchworkModelAdapter>();

  register(adapter: BranchworkModelAdapter): void {
    this.providers.set(adapter.id, adapter);
  }

  get(providerId: string): BranchworkModelAdapter {
    const adapter = this.providers.get(providerId);
    if (!adapter) {
      throw new Error(`Unknown model provider: ${providerId}`);
    }
    return adapter;
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  list(): BranchworkModelAdapter[] {
    return [...this.providers.values()];
  }

  listModels(): (ModelInfo & { providerId: string })[] {
    return this.list().flatMap((adapter) =>
      adapter.listModels().map((m) => ({ ...m, providerId: adapter.id }))
    );
  }
}

export const globalRegistry = new ProviderRegistry();
