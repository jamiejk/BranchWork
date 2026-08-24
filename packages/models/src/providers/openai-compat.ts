import type {
  BranchworkModelAdapter,
  ModelCapabilities,
  ModelEvent,
  ModelInfo,
  StructuredGenerationRequest,
  TextGenerationRequest,
} from "../types";

export interface EndpointConfig {
  baseURL: string;
  apiKey: string;
}

export type EndpointResolver = (providerId: string) => EndpointConfig | null;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<
    | {
        delta?: { content?: string | null };
        finish_reason?: string | null;
      }
    | {
        message?: { content?: string | null };
        finish_reason?: string | null;
      }
  >;
  error?: { message?: string };
}

const EFFORT_BY_MODEL_HINT = /\b(grok-[3-9]|o[134](-|$)|gpt-5|qwq|deepseek-reason|r1)/i;

export function modelSupportsEffort(modelId: string): boolean {
  return EFFORT_BY_MODEL_HINT.test(modelId);
}

/**
 * Adapter for any OpenAI-compatible chat completions endpoint
 * (xAI, OpenAI, DeepSeek, Mistral, Ollama, LiteLLM proxies, ...).
 * Credentials/base URLs are supplied per provider through `resolveEndpoint`,
 * so they never live in code.
 */
export class OpenAiCompatAdapter implements BranchworkModelAdapter {
  readonly id: string;
  readonly label: string;
  private readonly resolveEndpoint: EndpointResolver;
  private readonly knownModels: ModelInfo[];

  constructor(id: string, label: string, resolveEndpoint: EndpointResolver, knownModels: ModelInfo[] = []) {
    this.id = id;
    this.label = label;
    this.resolveEndpoint = resolveEndpoint;
    this.knownModels = knownModels;
  }

  listModels(): ModelInfo[] {
    return this.knownModels;
  }

  capabilities(): ModelCapabilities {
    return {
      streaming: true,
      structuredOutput: true,
      toolCalling: false,
      imageInput: false,
      pdfInput: false,
      embeddings: false,
      maxInputTokens: null,
      maxOutputTokens: null,
    };
  }

  async *streamText(request: TextGenerationRequest): AsyncIterable<ModelEvent> {
    const endpoint = this.resolveEndpoint(request.providerId);
    if (!endpoint || !endpoint.baseURL || !endpoint.apiKey) {
      yield {
        type: "error",
        message: `No API endpoint or key configured for provider "${request.providerId}". Add them under Model settings.`,
      };
      return;
    }

    const messages: ChatMessage[] = [];
    if (request.system) messages.push({ role: "system", content: request.system });
    if (request.contextText) {
      messages.push({
        role: "system",
        content: `Research material for reference:\n\n${request.contextText}`,
      });
    }
    messages.push({ role: "user", content: request.prompt });

    const baseBody: Record<string, unknown> = {
      model: request.modelId,
      messages,
      stream: true,
    };
    if (request.temperature !== undefined) baseBody.temperature = request.temperature;
    if (request.maxOutputTokens !== undefined) baseBody.max_tokens = request.maxOutputTokens;

    const attemptBodies: Record<string, unknown>[] = [baseBody];
    if (request.reasoningEffort && modelSupportsEffort(request.modelId)) {
      // relays/upstreams that don't know reasoning_effort 400 the whole
      // request — queue a stripped retry so the stream still runs
      attemptBodies.unshift({ ...baseBody, reasoning_effort: request.reasoningEffort });
    }

    let response: Response | null = null;
    let lastError = "";
    for (const body of attemptBodies) {
      try {
        response = await fetch(`${trimBase(endpoint.baseURL)}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${endpoint.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: request.signal,
        });
      } catch (error) {
        lastError = `Request failed: ${(error as Error).message}`;
        continue;
      }
      if (response.ok && response.body) break;
      lastError = `${response.status} ${response.statusText}: ${await safeErrorText(response)}`;
      if (response.status !== 400 && response.status !== 422) {
        yield { type: "error", message: lastError };
        return;
      }
      response = null; // try the next, plainer variant
    }

    if (!response || !response.ok || !response.body) {
      yield { type: "error", message: lastError || "Request failed." };
      return;
    }

    let buffer = "";
    let emitted = false;
    let finishReason = "stop";
    try {
      for await (const event of parseSseStream(response.body.getReader(), request.signal)) {
        if (event === "[DONE]") break;
        let chunk: ChatCompletionResponse;
        try {
          chunk = JSON.parse(event) as ChatCompletionResponse;
        } catch {
          continue;
        }
        const choice = chunk.choices?.[0];
        if (chunk.error?.message) {
          yield { type: "error", message: chunk.error.message };
          return;
        }
        if (choice && "delta" in choice) {
          const delta = choice.delta?.content;
          if (delta) {
            emitted = true;
            yield { type: "delta", text: delta };
          }
          const finish = choice.finish_reason;
          if (finish && finish !== "stop" && finish !== null) {
            finishReason = finish === "length" ? "length" : "stop";
          }
        }
      }
    } catch (error) {
      yield { type: "error", message: `Stream failed: ${(error as Error).message}` };
      return;
    }
    yield { type: "done", finishReason: emitted ? finishReason : "empty" };
  }

  async generateObject<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    const endpoint = this.resolveEndpoint(request.providerId);
    if (!endpoint || !endpoint.baseURL || !endpoint.apiKey) {
      throw new Error(`No API endpoint or key configured for provider "${request.providerId}".`);
    }

    const messages: ChatMessage[] = [];
    if (request.system) messages.push({ role: "system", content: request.system });
    messages.push({
      role: "system",
      content:
        "Respond with a single JSON object and nothing else. No markdown fences, no commentary.",
    });
    if (request.contextText) {
      messages.push({ role: "system", content: `Research material:\n\n${request.contextText}` });
    }
    messages.push({
      role: "user",
      content: `${request.prompt}\n\nPayload:\n${JSON.stringify(request.payload ?? {})}`,
    });

    const body: Record<string, unknown> = {
      model: request.modelId,
      messages,
      stream: false,
      response_format: { type: "json_object" },
    };

    let response = await fetch(`${trimBase(endpoint.baseURL)}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${endpoint.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });
    // some providers reject response_format; retry once without it
    if (!response.ok && (response.status === 400 || response.status === 422)) {
      const { response_format: _omit, ...plain } = body;
      response = await fetch(`${trimBase(endpoint.baseURL)}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${endpoint.apiKey}`,
        },
        body: JSON.stringify(plain),
        signal: request.signal,
      });
    }
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${await safeErrorText(response)}`);
    }
    const json = (await response.json()) as ChatCompletionResponse;
    if (json.error?.message) throw new Error(json.error.message);
    const first = json.choices?.[0];
    const content = (first && "message" in first ? first.message?.content : undefined) ?? "";
    return request.parse(tryParseJson(content));
  }
}

function trimBase(baseURL: string): string {
  return baseURL.replace(/\/+$/, "");
}

async function safeErrorText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text) as ChatCompletionResponse;
      return json.error?.message ?? text.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return "";
  }
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.search(/[{[]/);
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON.");
  }
}

async function* parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    if (signal?.aborted) {
      void reader.cancel().catch(() => {});
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    let dataLines: string[] = [];
    for (const line of lines) {
      if (line === "") {
        if (dataLines.length > 0) {
          yield dataLines.join("\n");
          dataLines = [];
        }
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
      // ignore event:, id:, retry:, comments
    }
  }
  buffer += decoder.decode();
  if (buffer.startsWith("data:")) {
    const payload = buffer.slice(5).trimStart();
    if (payload && payload !== "[DONE]") yield payload;
  }
}
