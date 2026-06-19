/**
 * @module providers/mistral
 *
 * Adapter for Mistral AI, OpenAI-compatible.
 * Endpoint: https://api.mistral.ai/v1/chat/completions
 * Key: process.env.MISTRAL_API_KEY
 */

import { OpenAICompatible } from "./openai.js";
import { env } from "./provider.js";

export class MistralProvider extends OpenAICompatible {
  constructor() {
    super({
      id: "mistral",
      label: "Mistral AI",
      baseUrl: "https://api.mistral.ai/v1",
      apiKey: env("MISTRAL_API_KEY"),
      nodes: [
        { provider: "mistral", model: "mistral-large-latest", tier: "frontier", context: 131_072 },
        { provider: "mistral", model: "mistral-medium-latest", tier: "balanced", context: 131_072 },
        { provider: "mistral", model: "mistral-small-latest", tier: "fast", context: 131_072 },
      ],
    });
  }
}
