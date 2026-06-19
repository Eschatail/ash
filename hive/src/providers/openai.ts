/**
 * @module providers/openai
 *
 * Adapter for the OpenAI Chat Completions API — and the shared shape that the
 * OpenAI-compatible vendors (Groq, xAI, DeepSeek, Mistral, and Ollama) reuse.
 *
 * Endpoint: POST https://api.openai.com/v1/chat/completions
 * Auth: `Authorization: Bearer <key>`
 * Key: process.env.OPENAI_API_KEY
 *
 * The `OpenAICompatible` base does all the work; OpenAI itself is one line of
 * configuration on top of it. Every other Bearer-token vendor is too.
 */

import type { ChatOptions, Message, ModelNode, ProviderId } from "../core/types.js";
import { BaseProvider, ProviderError, postJson, postSse } from "./provider.js";

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
}

interface ChatCompletionChunk {
  choices?: { delta?: { content?: string | null } }[];
}

/** Configuration for an OpenAI-compatible endpoint. */
export interface OpenAICompatibleConfig {
  readonly id: ProviderId;
  readonly label: string;
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly nodes: readonly ModelNode[];
  /** Some local servers (Ollama) need no key — set true to skip the check. */
  readonly keyless?: boolean;
  /** Extra headers (e.g. for proxies). */
  readonly extraHeaders?: Readonly<Record<string, string>>;
}

/**
 * Base class implementing the OpenAI `/chat/completions` contract. Vendors that
 * mirror this wire format extend it with nothing more than configuration.
 */
export class OpenAICompatible extends BaseProvider {
  readonly id: ProviderId;
  readonly label: string;
  readonly nodes: readonly ModelNode[];
  protected readonly baseUrl: string;
  protected readonly apiKey: string | undefined;
  protected readonly keyless: boolean;
  protected readonly extraHeaders: Readonly<Record<string, string>>;

  constructor(cfg: OpenAICompatibleConfig) {
    super();
    this.id = cfg.id;
    this.label = cfg.label;
    this.nodes = cfg.nodes;
    this.baseUrl = cfg.baseUrl.replace(/\/$/, "");
    this.apiKey = cfg.apiKey;
    this.keyless = cfg.keyless ?? false;
    this.extraHeaders = cfg.extraHeaders ?? {};
  }

  override get available(): boolean {
    return this.keyless || Boolean(this.apiKey);
  }

  protected headers(): Record<string, string> {
    const h: Record<string, string> = { ...this.extraHeaders };
    if (this.apiKey) h["authorization"] = `Bearer ${this.apiKey}`;
    else if (!this.keyless) throw new ProviderError(this.id, `missing API key`);
    return h;
  }

  protected url(): string {
    return `${this.baseUrl}/chat/completions`;
  }

  protected body(messages: readonly Message[], opts?: ChatOptions): Record<string, unknown> {
    return {
      model: this.resolveModel(opts),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: opts?.maxTokens ?? 1024,
      temperature: opts?.temperature ?? 0.7,
      ...(opts?.stop ? { stop: opts.stop } : {}),
    };
  }

  async chat(messages: readonly Message[], opts?: ChatOptions): Promise<string> {
    const data = await postJson<ChatCompletionResponse>(
      this.id,
      this.url(),
      this.body(messages, opts),
      this.headers(),
      opts?.signal,
    );
    return (data.choices?.[0]?.message?.content ?? "").trim();
  }

  async *stream(messages: readonly Message[], opts?: ChatOptions): AsyncIterable<string> {
    for await (const payload of postSse(this.id, this.url(), this.body(messages, opts), this.headers(), opts?.signal)) {
      let chunk: ChatCompletionChunk;
      try {
        chunk = JSON.parse(payload) as ChatCompletionChunk;
      } catch {
        continue;
      }
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

import { env } from "./provider.js";

export class OpenAIProvider extends OpenAICompatible {
  constructor() {
    super({
      id: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: env("OPENAI_API_KEY"),
      nodes: [
        { provider: "openai", model: "gpt-5.1", tier: "frontier", context: 256_000 },
        { provider: "openai", model: "gpt-5.1-mini", tier: "balanced", context: 256_000 },
        { provider: "openai", model: "gpt-5.1-nano", tier: "fast", context: 128_000 },
      ],
    });
  }
}
