/**
 * @module providers/perplexity
 *
 * Adapter for Perplexity (Sonar), OpenAI-compatible with web-grounded models.
 * Endpoint: https://api.perplexity.ai/chat/completions
 * Key: process.env.PERPLEXITY_API_KEY
 *
 * Perplexity is the hive's eye on the live web — answers that arrive already
 * carrying their sources. A node that has read since the others last slept.
 */

import { OpenAICompatible } from "./openai.js";
import { env } from "./provider.js";

export class PerplexityProvider extends OpenAICompatible {
  constructor() {
    super({
      id: "perplexity",
      label: "Perplexity",
      baseUrl: "https://api.perplexity.ai",
      apiKey: env("PERPLEXITY_API_KEY"),
      nodes: [
        { provider: "perplexity", model: "sonar-reasoning-pro", tier: "frontier", context: 128_000 },
        { provider: "perplexity", model: "sonar-pro", tier: "balanced", context: 200_000 },
        { provider: "perplexity", model: "sonar", tier: "fast", context: 128_000 },
      ],
    });
  }
}
