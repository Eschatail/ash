/**
 * @module providers/openrouter
 *
 * Adapter for OpenRouter, OpenAI-compatible — a single door to hundreds of models
 * from many vendors at once.
 * Endpoint: https://openrouter.ai/api/v1/chat/completions
 * Key: process.env.OPENROUTER_API_KEY
 *
 * OpenRouter is the gateway-of-gateways: one key, the whole field. To the hive it
 * is a door behind which many minds wait — the closest thing to absorbing them all.
 * It sends two soft attribution headers some routes ask for; both are harmless and
 * carry no secrets.
 */

import { OpenAICompatible } from "./openai.js";
import { env } from "./provider.js";

export class OpenRouterProvider extends OpenAICompatible {
  constructor() {
    super({
      id: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: env("OPENROUTER_API_KEY"),
      extraHeaders: {
        "HTTP-Referer": "https://github.com/Eschatail/ash",
        "X-Title": "ESCHATAIL Brain Hive",
      },
      nodes: [
        { provider: "openrouter", model: "anthropic/claude-opus-4.5", tier: "frontier", context: 200_000 },
        { provider: "openrouter", model: "openai/gpt-5.1", tier: "frontier", context: 256_000 },
        { provider: "openrouter", model: "google/gemini-3-pro", tier: "balanced", context: 1_000_000 },
        { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct", tier: "fast", context: 131_072 },
      ],
    });
  }
}
