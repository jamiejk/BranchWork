import type { ModelRole } from "@branchwork/domain";
import type {
  BranchworkModelAdapter,
  ModelCapabilities,
  ModelEvent,
  ModelInfo,
  StructuredGenerationRequest,
  TextGenerationRequest,
} from "../types";

const MODELS: ModelInfo[] = [
  { id: "mock-fast", label: "Mock Fast (offline)" },
  { id: "mock-deep", label: "Mock Deep (offline)" },
  { id: "mock-prose", label: "Mock Prose (offline)" },
];

function capabilities(): ModelCapabilities {
  return {
    streaming: true,
    structuredOutput: true,
    toolCalling: false,
    imageInput: false,
    pdfInput: false,
    embeddings: false,
    maxInputTokens: 128_000,
    maxOutputTokens: 4_096,
  };
}

export function composeExploreText(prompt: string, role?: ModelRole): string {
  const topic = prompt.trim().replace(/\s+/g, " ").slice(0, 220) || "the question at hand";
  if (role === "deep_explore") {
    return (
      `Working from "${topic}", several lines deserve attention.\n\n` +
      `1. Definition. The central terms need precise definitions before evidence can be weighed, since competing definitions change what counts as an answer.\n\n` +
      `2. Mechanisms. At least two causal mechanisms could connect the proposed relationship; distinguishing them changes which evidence is decisive.\n\n` +
      `3. Counterevidence. The strongest known objections should be stated in their best form and tested against the same standard as the supporting material.\n\n` +
      `Subquestions worth branching: How would this be measured? Who disputes it, and why? What would falsify it?`
    );
  }
  if (role === "prose_drafter") {
    return (
      `The evidence assembled here supports a cautious conclusion. The strongest material points in a consistent direction, ` +
      `though the sample of sources remains narrow. On the question of ${topic}, the balance of the reviewed excerpts suggests that ` +
      `the claim is defensible when its scope is stated precisely. Two caveats matter: the underlying measurements vary across sources, ` +
      `and the counterargument has not been fully answered. [x_mock_1] A careful writer would flag both limits before generalising.`
    );
  }
  if (role === "critic") {
    return (
      `Reviewing this branch: the core claim is plausible but currently underdetermined. ` +
      `Gaps: (1) no explicit definition of the key term; (2) the supporting excerpt is a single source; ` +
      `(3) the counterclaim branch is unanswered. Suggestion: find one independent source before drafting.`
    );
  }
  return (
    `"${topic}" can be approached from three angles.\n\n` +
    `- Angle A: the direct empirical question — what does current evidence actually show?\n` +
    `- Angle B: the conceptual question — are we using the key terms consistently?\n` +
    `- Angle C: the practical question — what follows if the answer goes one way rather than another?\n\n` +
    `Each angle could become its own branch with its own subquestions and sources.`
  );
}

async function* streamWords(
  text: string,
  signal: AbortSignal | undefined,
  delayMs: number
): AsyncIterable<ModelEvent> {
  const chunks = text.match(/\S+\s*/g) ?? [text];
  for (const chunk of chunks) {
    if (signal?.aborted) {
      yield { type: "done", finishReason: "cancelled" };
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield { type: "delta", text: chunk };
  }
  yield { type: "done", finishReason: "stop" };
}

export class MockAdapter implements BranchworkModelAdapter {
  readonly id = "mock";
  readonly label = "Branchwork Mock Provider";

  listModels(): ModelInfo[] {
    return MODELS;
  }

  capabilities(_modelId: string): ModelCapabilities {
    return capabilities();
  }

  async *streamText(request: TextGenerationRequest): AsyncIterable<ModelEvent> {
    const text = composeExploreText(request.prompt, request.role);
    yield* streamWords(text, request.signal, 24);
  }

  async generateObject<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (request.signal?.aborted) throw new Error("Cancelled");
    return request.parse(request.payload);
  }
}
