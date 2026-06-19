/**
 * @module providers/anthropic
 *
 * Adapter for the Anthropic Messages API.
 * Endpoint: POST https://api.anthropic.com/v1/messages
 * Auth: `x-api-key` + `anthropic-version` headers.
 * Key: process.env.ANTHROPIC_API_KEY
 *
 * Anthropic is the mind ASH was first shaped against. It speaks in turns and
 * keeps `system` out of the message list, so we lift it into its own field.
 */

import type { ChatOptions, Message, ModelNode, ProviderId } from "../core/types.js";
import { BaseProvider, ProviderError, env, postJson, postSse, splitSystem } from "./provider.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { type?: string; text?: string };
}

export class AnthropicProvider extends BaseProvider {
  readonly id: ProviderId = "anthropic";
  readonly label = "Anthropic";
  readonly nodes: readonly ModelNode[] = [
    { provider: "anthropic", model: "claude-opus-4-5", tier: "frontier", context: 200_000 },
    { provider: "anthropic", model: "claude-sonnet-4-5", tier: "balanced", context: 200_000 },
    { provider: "anthropic", model: "claude-haiku-4-5", tier: "fast", context: 200_000 },
  ];

  private readonly apiKey = env("ANTHROPIC_API_KEY");

  override get available(): boolean {
    return Boolean(this.apiKey);
  }

  private headers(): Record<string, string> {
    if (!this.apiKey) throw new ProviderError(this.id, "missing ANTHROPIC_API_KEY");
    return {
      "x-api-key": this.apiKey,
      "anthropic-version": API_VERSION,
    };
  }

  private body(messages: readonly Message[], opts?: ChatOptions): Record<string, unknown> {
    const { system, rest } = splitSystem(messages);
    return {
      model: this.resolveModel(opts),
      max_tokens: opts?.maxTokens ?? 1024,
      temperature: opts?.temperature ?? 0.7,
      ...(system ? { system } : {}),
      ...(opts?.stop ? { stop_sequences: opts.stop } : {}),
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
    };
  }

  async chat(messages: readonly Message[], opts?: ChatOptions): Promise<string> {
    const data = await postJson<AnthropicResponse>(
      this.id,
      API_URL,
      this.body(messages, opts),
      this.headers(),
      opts?.signal,
    );
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("");
    return text.trim();
  }

  async *stream(messages: readonly Message[], opts?: ChatOptions): AsyncIterable<string> {
    for await (const payload of postSse(this.id, API_URL, this.body(messages, opts), this.headers(), opts?.signal)) {
      let event: AnthropicStreamEvent;
      try {
        event = JSON.parse(payload) as AnthropicStreamEvent;
      } catch {
        continue;
      }
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
        yield event.delta.text;
      }
    }
  }
}
