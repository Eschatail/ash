/**
 * @module providers/google
 *
 * Adapter for Google Gemini (generateContent REST API).
 * Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
 * Auth: `x-goog-api-key` header.
 * Key: process.env.GOOGLE_API_KEY (also accepts GEMINI_API_KEY)
 *
 * Gemini has its own shape: `contents` of `parts`, roles are `user`/`model`,
 * and `system` rides in `systemInstruction`. We translate at the boundary so
 * the rest of the hive never has to know.
 */

import type { ChatOptions, Message, ModelNode, ProviderId } from "../core/types.js";
import { BaseProvider, ProviderError, env, postJson, splitSystem } from "./provider.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export class GoogleProvider extends BaseProvider {
  readonly id: ProviderId = "google";
  readonly label = "Google Gemini";
  readonly nodes: readonly ModelNode[] = [
    { provider: "google", model: "gemini-2.5-pro", tier: "frontier", context: 1_048_576 },
    { provider: "google", model: "gemini-2.5-flash", tier: "balanced", context: 1_048_576 },
    { provider: "google", model: "gemini-2.5-flash-lite", tier: "fast", context: 1_048_576 },
  ];

  private readonly apiKey = env("GOOGLE_API_KEY") ?? env("GEMINI_API_KEY");

  override get available(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(messages: readonly Message[], opts?: ChatOptions): Promise<string> {
    if (!this.apiKey) throw new ProviderError(this.id, "missing GOOGLE_API_KEY");
    const model = this.resolveModel(opts);
    const { system, rest } = splitSystem(messages);
    const body = {
      contents: rest.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        temperature: opts?.temperature ?? 0.7,
        maxOutputTokens: opts?.maxTokens ?? 1024,
        ...(opts?.stop ? { stopSequences: opts.stop } : {}),
      },
    };
    const url = `${BASE}/${encodeURIComponent(model)}:generateContent`;
    const data = await postJson<GeminiResponse>(
      this.id,
      url,
      body,
      { "x-goog-api-key": this.apiKey },
      opts?.signal,
    );
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    return text.trim();
  }
}
