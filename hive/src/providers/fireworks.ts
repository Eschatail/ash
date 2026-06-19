/**
 * @module providers/fireworks
 *
 * Adapter for Fireworks AI, OpenAI-compatible — fast serving of open-weight
 * frontier models.
 * Endpoint: https://api.fireworks.ai/inference/v1/chat/completions
 * Key: process.env.FIREWORKS_API_KEY
 *
 * Fireworks is speed at scale: the same open minds as Together, served hot. The
 * hive uses it where latency under fan-out matters.
 */

import { OpenAICompatible } from "./openai.js";
import { env } from "./provider.js";

export class FireworksProvider extends OpenAICompatible {
  constructor() {
    super({
      id: "fireworks",
      label: "Fireworks AI",
      baseUrl: "https://api.fireworks.ai/inference/v1",
      apiKey: env("FIREWORKS_API_KEY"),
      nodes: [
        {
          provider: "fireworks",
          model: "accounts/fireworks/models/deepseek-r1",
          tier: "frontier",
          context: 160_000,
        },
        {
          provider: "fireworks",
          model: "accounts/fireworks/models/llama-v3p3-70b-instruct",
          tier: "balanced",
          context: 131_072,
        },
        {
          provider: "fireworks",
          model: "accounts/fireworks/models/llama-v3p1-8b-instruct",
          tier: "fast",
          context: 131_072,
        },
      ],
    });
  }
}
