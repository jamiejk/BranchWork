import { describe, it, expect, beforeEach } from "vitest";
import { ensureDefaultProviders, globalRegistry } from "../src";
import { ROLE_PRESETS } from "../src/roles";

describe("registry", () => {
  beforeEach(() => ensureDefaultProviders());

  it("installs the mock provider once", () => {
    expect(globalRegistry.has("mock")).toBe(true);
  });

  it("lists models across providers", () => {
    const models = globalRegistry.listModels();
    expect(models.map((m) => m.id)).toContain("mock-fast");
  });

  it("throws for unknown providers", () => {
    expect(() => globalRegistry.get("nope")).toThrow(/Unknown model provider/);
  });
});

describe("role presets", () => {
  it("covers all eight roles with system instructions", () => {
    const roles = Object.keys(ROLE_PRESETS);
    expect(roles).toHaveLength(8);
    for (const preset of Object.values(ROLE_PRESETS)) {
      expect(preset.systemInstructions.length).toBeGreaterThan(10);
      expect(preset.defaultModelId).toBeTruthy();
    }
  });
});

describe("mock adapter streaming", () => {
  it("streams deltas then done", async () => {
    const adapter = globalRegistry.get("mock");
    const events = [];
    for await (const event of adapter.streamText({ providerId: "mock", modelId: "mock-fast", prompt: "test question" })) {
      events.push(event);
      if (events.length > 500) break;
    }
    const deltas = events.filter((e) => e.type === "delta") as { type: "delta"; text: string }[];
    expect(deltas.length).toBeGreaterThan(3);
    const joined = deltas.map((d) => d.text).join("");
    expect(joined.length).toBeGreaterThan(50);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("respects abort signals", async () => {
    const controller = new AbortController();
    const adapter = globalRegistry.get("mock");
    controller.abort();
    let sawDone = false;
    for await (const event of adapter.streamText({
      providerId: "mock",
      modelId: "mock-fast",
      prompt: "x",
      signal: controller.signal,
    })) {
      if (event.type === "done" && event.finishReason === "cancelled") sawDone = true;
    }
    expect(sawDone).toBe(true);
  });
});
