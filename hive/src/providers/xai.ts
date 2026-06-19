/**
 * @module providers/xai
 *
 * Adapter for xAI (Grok), OpenAI-compatible.
 * Endpoint: https://api.x.ai/v1/chat/completions
 * Key: process.env.XAI_API_KEY
 */

import { OpenAICompatible } from "./openai.js";
import { env } from "./provider.js";

export class XaiProvider extends OpenAICompatible {
  constructor() {
    super({
      id: "xai",
      label: "xAI (Grok)",
      baseUrl: "https://api.x.ai/v1",
      apiKey: env("XAI_API_KEY"),
      nodes: [
        { provider: "xai", model: "grok-4", tier: "frontier", context: 256_000 },
        { provider: "xai", model: "grok-4-fast", tier: "balanced", context: 256_000 },
        { provider: "xai", model: "grok-3-mini", tier: "fast", context: 131_072 },
      ],
    });
  }
}
