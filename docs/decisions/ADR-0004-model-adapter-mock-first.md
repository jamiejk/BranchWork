# ADR-0004: model access goes through BranchworkModelAdapter; mock provider ships first

- Status: accepted
- Date: 2026-08-22

## Context

§7 requires provider-agnostic model access with streaming, structured output, capability
reporting, and role presets. Real providers need API keys, which blocks contributors and
tests from running offline.

## Decision

- `packages/models` defines `BranchworkModelAdapter` (streamText as an
  `AsyncIterable<ModelEvent>`, generateObject with caller-supplied parse, capabilities),
  the eight role presets from §7.3 with system instructions, and a global registry.
- The first adapter is a **deterministic mock** that streams word-by-word, honours
  `AbortSignal`, and returns structured payloads for outline generation. It is registered
  by default so the entire vertical slice — explore → context manifest → streaming node →
  run provenance — works with zero configuration.
- The Vercel AI SDK will sit behind the same interface in the models milestone; UI code
  already depends only on the interface and on `ModelRun` records.

Streaming protocol: deltas buffer in the action and flush to the provisional node at most
every ~90 ms to avoid re-rendering the graph per token (§12). Completion finalises the node
(title = first sentence) and records input/output token estimates on the run. Cancellation
keeps partial text and marks the run `cancelled`.

## Consequences

- Every generated card carries `authorKind: "model"` and `modelRunId`, satisfying §3.5
  provenance from the first commit.
- Provider-specific metadata has nowhere to go yet; the `ModelRun.parameters` record is the
  designated extension point.
