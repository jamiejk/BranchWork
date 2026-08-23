export * from "./types";
export * from "./roles";
export * from "./registry";
export * from "./providers/mock";
export * from "./providers/openai-compat";

import { globalRegistry } from "./registry";
import { MockAdapter } from "./providers/mock";

let installed = false;

export function ensureDefaultProviders(): void {
  if (installed) return;
  globalRegistry.register(new MockAdapter());
  installed = true;
}
